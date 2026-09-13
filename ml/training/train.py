"""
LandPulse AI — ML Training Orchestrator
=========================================
Orchestrates the full Phase 2 ML pipeline:
  1. Load latest processed data
  2. Run feature engineering
  3. Check leakage
  4. Generate data gap report
  5. Train anomaly scorer (if sufficient data)
  6. Save model + metadata

Usage:
    python train.py [--min-records 50]
"""

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

ML_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ML_DIR.parent))


def main():
    parser = argparse.ArgumentParser(description="LandPulse AI ML Training Pipeline")
    parser.add_argument("--min-records", type=int, default=50,
                        help="Minimum records to attempt anomaly training")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("LandPulse AI — Phase 2 ML Training Pipeline")
    print("=" * 60)

    # ── Step 1: Generate data gap report ─────────────────────────────────────
    print("\n[1/5] Generating data gap report...")
    from ml.training.data_gap_report import generate_report
    gap_report = generate_report(
        ML_DIR / "data" / "processed" / "data_gap_report.json"
    )
    print(f"      -> Supervised training: DEFERRED")
    print(f"      -> Reason: {gap_report.get('supervised_target_definition', {}).get('reason', '')[:80]}...")

    # ── Step 2: Load processed data ───────────────────────────────────────────
    print("\n[2/5] Loading processed data...")
    processed = ML_DIR / "data" / "processed"
    bhoomi_csvs = sorted(processed.glob("bhoomirashi_public_*.csv"), reverse=True)
    datagov_csv = processed / "datagov_multiyear_delayed_projects.csv"

    if not bhoomi_csvs and not datagov_csv.exists():
        print("\n[WARNING] No ingested data found. Run ingestion first:")
        print("    python ml/data_ingestion/bhoomirashi_scraper.py")
        print("    python ml/data_ingestion/datagov_ingester.py")
        print("\nML training DEFERRED — insufficient data.")
        _write_deferred_status(ML_DIR, "No ingested data found")
        return

    import pandas as pd
    from ml.data_processing.cleaner import clean_bhoomirashi
    from ml.features.feature_engineering import engineer_features, get_model_features, write_feature_catalog

    dfs = []
    if bhoomi_csvs:
        for c in bhoomi_csvs:
            dfs.append(clean_bhoomirashi(c))
    if datagov_csv.exists():
        df_dg = pd.read_csv(datagov_csv, dtype=str)
        # Standardize DataGovIn columns for cleaner
        if "total_area_ha" in df_dg.columns and "land_required_ha" not in df_dg.columns:
            df_dg["land_required_ha"] = df_dg["total_area_ha"]
        if "estimated_compensation_inr" in df_dg.columns and "sanctioned_la_cost_crore" not in df_dg.columns:
            df_dg["sanctioned_la_cost_crore"] = (pd.to_numeric(df_dg["estimated_compensation_inr"], errors="coerce") / 10000000.0).astype(str)
        if "state_code" in df_dg.columns and "state" not in df_dg.columns:
            df_dg["state"] = df_dg["state_code"]
        if "executing_agency" in df_dg.columns and "agency" not in df_dg.columns:
            df_dg["agency"] = df_dg["executing_agency"]
        dfs.append(df_dg)

    df_clean = pd.concat(dfs, ignore_index=True)
    print(f"      -> Loaded & cleaned {len(df_clean)} rows from BhoomiRashi & Data.gov.in datasets")

    feat_df = engineer_features(df_clean)
    feature_cols = get_model_features()

    write_feature_catalog(ML_DIR / "features" / "feature_catalog.json")
    print(f"      -> Features: {feature_cols}")
    print(f"      -> Eligible rows: {feat_df.get('_prediction_eligible', pd.Series()).sum()}")

    # ── Step 4: Leakage check ─────────────────────────────────────────────────
    print("\n[4/5] Checking for data leakage...")
    from ml.features.leakage_check import check_feature_set
    leakage = check_feature_set(feature_cols, mode="prospective")
    if leakage["leakage_detected"]:
        print(f"      [ERROR] LEAKAGE DETECTED — Training ABORTED")
        for v in leakage["violations"]:
            print(f"         - {v['feature']}: {v['reason']}")
        sys.exit(1)
    print(f"      [OK] No leakage detected")

    # ── Step 5: Train anomaly scorer ──────────────────────────────────────────
    print("\n[5/5] Training anomaly scorer...")
    from ml.training.anomaly_scorer import train

    result = train(feat_df, feature_cols)

    if result.get("status") == "INSUFFICIENT_DATA":
        print(f"\n[WARNING] INSUFFICIENT DATA: {result['reason']}")
        print(f"  Available: {result['n_available']} rows")
        print(f"  Required : {result['n_required']} rows")
        print("\n  Action: Run bhoomirashi_scraper.py with more states/pages")
        _write_deferred_status(ML_DIR, result["reason"])
        return

    print(f"\n[OK] Training complete!")
    print(f"   Model version : {result['model_version']}")
    print(f"   Records used  : {result['record_count_used']}")
    print(f"   Anomaly rate  : {result['evaluation_metrics']['anomaly_rate']:.1%}")
    print(f"   Model path    : {result['model_path']}")
    print(f"\n   {result['authenticity_statement'][:100]}...")

    print("\n" + "=" * 60)
    print("IMPORTANT: This model produces ANOMALY SCORES, not delay predictions.")
    print("All API responses and UI MUST label outputs as anomaly scores.")
    print("=" * 60 + "\n")


def _write_deferred_status(ml_dir: Path, reason: str) -> None:
    """Write a deferred training status file so the API knows the state."""
    status = {
        "status": "DEFERRED",
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action_required": "Run ingestion scripts to collect real data, then re-run train.py",
    }
    (ml_dir / "models" / "training_status.json").write_text(
        json.dumps(status, indent=2)
    )


if __name__ == "__main__":
    main()
