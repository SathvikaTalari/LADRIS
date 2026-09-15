"""
Standalone end-to-end ML pipeline runner for LADRIS.

Runs the complete pipeline WITHOUT needing the FastAPI server:
  1. Initialize the database (creates all tables)
  2. Generate synthetic training data (if no real data exists)
  3. Ingest CSV data into staging
  4. Promote staging → canonical (ETL)
  5. Train ML models (classifier + regressor with CV)
  6. Score all projects (risk scores + SHAP explanations)
  7. Print evaluation report

Usage:
    # Full pipeline with synthetic data:
    python scripts/run_ml_pipeline.py

    # Use your own CSV file:
    python scripts/run_ml_pipeline.py --csv path/to/your_data.csv --source my_source

    # Use existing DB (skip ingestion):
    python scripts/run_ml_pipeline.py --skip-ingest

    # Generate only N synthetic projects:
    python scripts/run_ml_pipeline.py --n-synthetic 300
"""
from __future__ import annotations

import argparse
import os
import sys

# ── Ensure project root is on path ───────────────────────────────────────────
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

import json
import tempfile
import shutil

from app.db.init_db import SessionLocal, init_db, DATABASE_URL
from app.db.schema import IngestionSource, Project, RiskScore
from app.ingestion.base import get_or_create_source
from app.ingestion.file_connector import pull_file_source
from app.etl.pipeline import promote_all_sources
from app.ml.train import run_training
from app.ml.predict import score_all_projects
from app.ml.evaluation import run_full_evaluation, print_evaluation_report
from app.ml.stage_predictor import train_stage_predictor, predict_stage_risks


def step(msg: str):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


def run_pipeline(
    csv_path: str | None = None,
    source_name: str = "synthetic_seed",
    config_path: str | None = None,
    skip_ingest: bool = False,
    n_synthetic: int = 500,
    seed: int = 42,
):
    # ── Step 1: Database ──────────────────────────────────────────────────────
    step("Step 1: Initialize Database")
    init_db()
    print(f"Database ready: {DATABASE_URL}")

    session = SessionLocal()

    # ── Step 2: Data preparation ──────────────────────────────────────────────
    if not skip_ingest:
        step("Step 2: Prepare Training Data")

        if csv_path and os.path.exists(csv_path):
            data_file = csv_path
            print(f"Using real CSV: {csv_path}")
        else:
            # Generate synthetic data
            print(f"Generating {n_synthetic} synthetic projects (seed={seed})...")
            from app.ml.synthetic_data import generate_synthetic_projects
            df = generate_synthetic_projects(n=n_synthetic, seed=seed)
            os.makedirs("data/incoming", exist_ok=True)
            data_file = "data/incoming/synthetic_projects.csv"
            df.to_csv(data_file, index=False)
            delayed = (df["Delayed (Y/N)"] == "Y").sum()
            not_delayed = (df["Delayed (Y/N)"] == "N").sum()
            ongoing = (df["Delayed (Y/N)"] == "").sum()
            print(f"Generated {len(df)} projects: {delayed} delayed, {not_delayed} on-time, {ongoing} ongoing")

        # ── Step 3: Ingest ────────────────────────────────────────────────────
        step("Step 3: Ingest CSV into Staging")
        # Create field-mapping config BEFORE ingestion so it's available for ETL
        if config_path is None:
            config_path = _create_temp_config(source_name)

        pull_file_source(
            session, data_file,
            source_name=source_name,
            config_path=config_path,
            triggered_by="run_ml_pipeline_script",
        )
        print(f"Staged records from: {data_file}")

        # ── Step 4: ETL ───────────────────────────────────────────────────────
        step("Step 4: ETL - Promote Staging -> Canonical")
        # Update the source config_path in DB so ETL finds the field mapping
        source = session.query(IngestionSource).filter_by(name=source_name).first()
        if source and config_path:
            source.config_path = config_path
            session.commit()

        etl_result = promote_all_sources(session)
        for src, counts in etl_result.items():
            print(f"  {src}: promoted={counts.get('promoted', 0)}, rejected={counts.get('rejected', 0)}")

    # ── Check we have enough labeled data ────────────────────────────────────
    project_count = session.query(Project).count()
    labeled_count = session.query(Project).filter(Project.is_delayed.isnot(None)).count()
    print(f"\nCanonical projects: {project_count} total, {labeled_count} labeled")

    if labeled_count < 10:
        print(
            f"\n[WARNING] Only {labeled_count} labeled projects. ML training needs at least 10.\n"
            "  Run with --n-synthetic 500 to generate more training data."
        )
        session.close()
        return

    # ── Step 5: Train Models ──────────────────────────────────────────────────
    step("Step 5: Train ML Models (LightGBM + Cross-Validation)")
    session.close()  # Training opens its own session
    try:
        eval_metadata = run_full_evaluation()
        version = eval_metadata["version"]
        eval_data = eval_metadata["evaluation"]

        print(f"\n[OK] Model version: {version}")
        print(f"   Labeled samples: {eval_data.get('n_labeled')}")
        cv = eval_data.get("cross_validation", {})
        if "oof_auc_roc" in cv:
            print(f"   Cross-Val AUC-ROC: {cv['oof_auc_roc']}")
            print(f"   Cross-Val F1:      {cv['oof_f1']}")
            print(f"   Cross-Val Recall:  {cv['oof_recall']}")
        tm = eval_data.get("train_metrics", {})
        if tm:
            print(f"   Train AUC-ROC:  {tm.get('auc_roc')}")
            print(f"   Train F1:       {tm.get('f1_score')}")
            cm = tm.get("confusion_matrix", {})
            print(f"   Confusion Matrix: TP={cm.get('tp')} FP={cm.get('fp')} TN={cm.get('tn')} FN={cm.get('fn')}")

        clf_m = eval_data.get("classifier", {})
        if clf_m:
            top_feats = clf_m.get("top_features", {})
            if top_feats:
                print(f"\n   Top delay predictors:")
                for feat, imp in list(top_feats.items())[:5]:
                    print(f"     {feat}: {imp:.0f}")

        reg_m = eval_data.get("regressor_metrics", {})
        if not reg_m.get("skipped"):
            print(f"\n   Delay Duration Regressor:")
            print(f"     MAE: {reg_m.get('mae_days')} days")
            print(f"     RMSE: {reg_m.get('rmse_days')} days")

    except Exception as e:
        print(f"\n[ERROR] Training failed: {e}")
        raise

    # ── Step 6: Score Projects ────────────────────────────────────────────────
    step("Step 6: Score All Projects (Risk Scores + SHAP)")
    session = SessionLocal()
    try:
        scores = score_all_projects(session)
        print(f"Scored {len(scores)} projects")

        high = [s for s in scores if s.risk_category.value == "high"]
        medium = [s for s in scores if s.risk_category.value == "medium"]
        low = [s for s in scores if s.risk_category.value == "low"]
        print(f"  HIGH risk:   {len(high)}")
        print(f"  MEDIUM risk: {len(medium)}")
        print(f"  LOW risk:    {len(low)}")

        if high:
            print(f"\n[ALERT] Sample HIGH-RISK project:")
            s = high[0]
            print(f"  Project ID: {s.project_id}")
            print(f"  Risk Score: {s.risk_score}")
            drivers = json.loads(s.top_drivers_json or "[]")
            for d in drivers[:2]:
                print(f"  Driver: {d['label']}")
                print(f"    Recommendation: {d['recommendation']}")

    finally:
        session.close()

    # ── Step 6b: Stage-Specific Predictions ──────────────────────────────────
    step("Step 6b: Train Stage-Specific Classifiers")
    session = SessionLocal()
    try:
        stage_bundle = train_stage_predictor(session)
        if stage_bundle.get("trained"):
            trained_stages = list(stage_bundle["stage_models"].keys())
            print(f"  Trained stage models: {trained_stages}")
            for stg, m in stage_bundle["stage_metrics"].items():
                print(f"    {stg}: n={m['n_samples']} | pos_rate={m['positive_rate']} | calibrated={m.get('calibrated')}")

            # Score all projects per-stage using trained classifiers
            stage_results = predict_stage_risks(session, stage_bundle)
            current = [r for r in stage_results if r["is_current_stage"]]
            high_s  = [r for r in current if r["risk_category"] == "high"]
            med_s   = [r for r in current if r["risk_category"] == "medium"]
            low_s   = [r for r in current if r["risk_category"] == "low"]
            print(f"\n  Current-stage predictions: {len(current)} projects")
            print(f"    HIGH:   {len(high_s)}")
            print(f"    MEDIUM: {len(med_s)}")
            print(f"    LOW:    {len(low_s)}")

            if high_s:
                sample = high_s[0]
                print(f"\n  Sample HIGH-RISK stage result:")
                print(f"    Project:             {sample['project_name']}")
                print(f"    Stage:               {sample['stage']}")
                print(f"    Risk Score:          {sample['risk_score']}")
                print(f"    Delay Probability:   {sample['delay_probability']}")
                print(f"    Expected Completion: {sample['expected_completion_date']}")
                print(f"    Drivers:             {sample['drivers']}")
        else:
            print(f"  Stage training skipped: {stage_bundle.get('error')}")
            print("  Falling back to rule-based stage scoring for /stage-risks endpoint.")
    except Exception as e:
        print(f"  [WARN] Stage training error (non-fatal): {e}")
    finally:
        session.close()

    # ── Step 7: Full Report ───────────────────────────────────────────────────
    step("Step 7: Evaluation Report")
    report = print_evaluation_report(eval_metadata)
    print(report)

    print(f"\n[DONE] ML Pipeline Complete!")
    print(f"   Model saved to: models/{version}/")
    print(f"   Integrate via: from app.ml.predict import score_all_projects")
    print(f"   Stage risks:   from app.ml.stage_predictor import predict_stage_risks")
    print(f"   Or via API:    POST /model/predict  |  GET /stage-risks")



def _create_temp_config(source_name: str) -> str:
    """Create a minimal YAML config for the synthetic CSV (matching its column headers)."""
    config_content = f"""source_name: "{source_name}"
connector_type: "file"
field_mapping:
  external_project_id: "Project ID"
  project_name: "Project Name"
  project_type: "Project Type"
  implementing_agency: "Implementing Agency"
  state: "State"
  district: "District"
  land_area_hectares: "Land Area (ha)"
  affected_families_count: "Affected Families"
  notification_date: "Notification Date"
  expected_completion_date: "Expected Completion"
  actual_completion_date: "Actual Completion"
  current_stage: "Current Stage"
  is_delayed: "Delayed (Y/N)"
  delay_days: "Delay (days)"
  compensation_sanctioned: "Compensation Sanctioned"
  compensation_disbursed: "Compensation Disbursed"
  legal_dispute_count: "Open Disputes"
  rehabilitation_progress_pct: "R&R Progress %"
"""
    config_path = f"config/sources/{source_name}.yaml"
    os.makedirs("config/sources", exist_ok=True)
    with open(config_path, "w") as f:
        f.write(config_content)
    return config_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="LADRIS end-to-end ML pipeline runner"
    )
    parser.add_argument("--csv", type=str, default=None,
                        help="Path to a real CSV file to ingest (default: generate synthetic)")
    parser.add_argument("--source", type=str, default="synthetic_seed",
                        help="Source name for the ingestion config")
    parser.add_argument("--config", type=str, default=None,
                        help="Path to YAML field-mapping config for your CSV")
    parser.add_argument("--skip-ingest", action="store_true",
                        help="Skip data ingestion (use what's already in the DB)")
    parser.add_argument("--n-synthetic", type=int, default=500,
                        help="Number of synthetic projects to generate (default: 500)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for synthetic data")
    args = parser.parse_args()

    run_pipeline(
        csv_path=args.csv,
        source_name=args.source,
        config_path=args.config,
        skip_ingest=args.skip_ingest,
        n_synthetic=args.n_synthetic,
        seed=args.seed,
    )
