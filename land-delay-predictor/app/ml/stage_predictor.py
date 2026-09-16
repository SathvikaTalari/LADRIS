"""
Stage-specific delay prediction.

The PS requires predicting delays at different stages of the land acquisition
lifecycle. This module:
1. Builds stage-level features (one row per project per lifecycle stage)
2. Trains a per-stage LightGBM classifier when enough labeled data exists
3. Falls back to a rule-based stage risk score when data is sparse
4. Returns per-stage risk scores with SHAP-like drivers and explanations

v2 fixes (2026-09-13):
- Stage classifiers now use the same regularisation floor as the main model
  (max_depth=6, min_child_samples=30, reg_alpha=2, reg_lambda=2, subsample=0.75)
- Removed deprecated categorical_feature= from fit() (LightGBM 4.7 compat)
- Added per-stage expected_completion_date computed from stage entered_at + STAGE_EXPECTED_DAYS
- Model-based scoring path now merges rule-based drivers so all results have explanations
- train_stage_predictor() is now wired into run_ml_pipeline.py
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sqlalchemy.orm import Session

from app.db.schema import LifecycleStage, Project, RiskScore
from app.ml.features import (
    STAGE_EXPECTED_DAYS,
    build_stage_features,
    build_feature_table,
    build_snapshot_feature_table,
)
from app.ml.model_store import load_model
from app.db.schema import ProjectSnapshot

# ── Feature configuration ─────────────────────────────────────────────────────

STAGE_FEATURE_COLS = [
    "project_type", "state", "district", "implementing_agency",
    "land_area_hectares", "affected_families_count",
    "days_since_notification", "days_to_expected_completion",
    "compensation_sanctioned", "compensation_disbursed",
    "compensation_disbursement_pct", "days_since_last_disbursement",
    "legal_dispute_count", "open_legal_dispute_count",
    "max_dispute_pendency_days", "rehabilitation_progress_pct",
    "resettlement_site_ready", "stakeholder_update_count_90d",
    "avg_days_between_updates", "stage_count_recorded",
    "district_historical_delay_rate", "agency_historical_delay_rate",
    "stage_tenure_days", "stage_overdue_days", "is_current_stage",
]
STAGE_CATEGORICAL_COLS = ["project_type", "state", "district", "implementing_agency"]

# Regularisation floor — mirrors the constants in train.py so stage classifiers
# don't overfit the same way the main classifier used to.
_REG = dict(
    max_depth=6,
    min_child_samples=30,
    reg_alpha=2.0,
    reg_lambda=2.0,
    subsample=0.75,
    colsample_bytree=0.75,
)


# ── Feature preparation ───────────────────────────────────────────────────────

def _prep_stage_df(df: pd.DataFrame) -> pd.DataFrame:
    """Set pd.Categorical for categorical cols so LightGBM 4.7 auto-detects them."""
    df = df.copy()
    for col in df.columns:
        if col in STAGE_CATEGORICAL_COLS:
            df[col] = df[col].astype("category")
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


# ── Label computation ─────────────────────────────────────────────────────────

def _stage_label_from_project(project_df: pd.DataFrame) -> pd.Series:
    """Map overall delay label to each stage row (simple fallback)."""
    return project_df["delayed_target"].astype(float)


def _stage_specific_delay_label(row: pd.Series) -> int | None:
    """
    Compute stage-specific delay label based on project outcome and stage timing.

    For completed projects, a stage is considered "delayed" if:
    - The project was delayed overall, AND
    - The stage was active during the delay period

    For ongoing projects, the label reflects whether the project is on track
    for that stage based on current progress.
    """
    if row.get("delayed_target") is None:
        return None  # Unknown

    if row.get("delayed_target") == 0:
        return 0  # Project not delayed → stage not delayed

    # Project is delayed — check if this stage itself contributed
    if row.get("stage_overdue"):
        return 1  # Stage itself is overdue

    if row.get("stage_tenure_days") and row.get("stage_tenure_days") > 90:
        return 1  # Stage tenure is unusually long (>3 months)

    # Non-overdue stage in a delayed project — inherit project label
    return int(row["delayed_target"])


# ── Stage-specific expected completion date ───────────────────────────────────

# Cumulative days from notification to the START of each lifecycle stage.
# Used to estimate stage-specific expected completion when StageEvent records
# are unavailable (the common case for synthetic/CSV-imported projects).
_STAGE_CUMULATIVE_START_DAYS: dict[str, int] = {
    "notification":     0,
    "survey":          30,
    "approval":        90,
    "compensation":   180,
    "legal_resolution": 300,
    "rehabilitation": 480,
    "possession":     600,
    "completed":      630,
}


def _stage_expected_completion(
    stage_name: str,
    stage_entered_at,
    days_since_notification=None,
) -> str | None:
    """
    Compute the expected completion date for a specific stage.

    Primary:  stage_entered_at + STAGE_EXPECTED_DAYS[stage]
    Fallback: notification_date + cumulative_days_to_stage_start + stage_duration
              (used when StageEvent records don't exist, e.g. CSV-imported projects)
    """
    try:
        stage_enum = LifecycleStage(stage_name)
    except (ValueError, KeyError):
        return None
    expected_days = STAGE_EXPECTED_DAYS.get(stage_enum, 90)

    if stage_entered_at is not None:
        # Exact: use actual stage start time
        completion_dt = stage_entered_at + timedelta(days=expected_days)
        return completion_dt.strftime("%Y-%m-%d")

    if days_since_notification is not None:
        # Fallback: estimate stage start from notification date
        try:
            days_since = float(days_since_notification)
        except (TypeError, ValueError):
            return None
        today = datetime.utcnow()
        notification_date = today - timedelta(days=days_since)
        cumulative_start = _STAGE_CUMULATIVE_START_DAYS.get(stage_name, 0)
        completion_dt = notification_date + timedelta(days=cumulative_start + expected_days)
        return completion_dt.strftime("%Y-%m-%d")

    return None  # No date info available


# ── Training ──────────────────────────────────────────────────────────────────

def train_stage_predictor(session: Session) -> dict:
    """Train per-stage delay classifiers from canonical project data.

    Returns a dict with model metadata and trained models, or an error dict
    if training is not possible with the available data.

    Uses the same regularisation floor as the main LightGBM classifier to
    prevent overfitting on small per-stage datasets.
    """
    stage_df = build_stage_features(session)
    if stage_df.empty:
        return {"error": "No projects available for stage prediction"}

    labeled = stage_df[stage_df["delayed_target"].notna()].copy()
    if len(labeled) < 10:
        return {"error": f"Only {len(labeled)} labeled stage rows; need at least 10"}

    # Compute stage-specific labels (not just project-level label)
    labeled["stage_specific_delay"] = labeled.apply(
        _stage_specific_delay_label, axis=1
    )
    labeled = labeled[labeled["stage_specific_delay"].notna()]

    X = _prep_stage_df(labeled[STAGE_FEATURE_COLS])
    y = labeled["stage_specific_delay"].astype(int)

    # Train one regularised, calibrated classifier per stage
    stage_models: dict = {}
    stage_metrics: dict = {}

    for stage in LifecycleStage:
        mask = labeled["stage"] == stage.value
        stage_rows = labeled[mask]
        if len(stage_rows) < 5:
            continue

        stage_X = X[mask]
        stage_y = y[mask]

        if stage_y.nunique() < 2:
            continue  # Need both classes to train a classifier

        # Regularised base model
        base = lgb.LGBMClassifier(
            n_estimators=150,
            learning_rate=0.05,
            num_leaves=20,
            objective="binary",
            random_state=42,
            verbose=-1,
            **_REG,
        )
        base.fit(stage_X, stage_y)

        # Calibrate probabilities (prevents saturated 0/1 outputs)
        n_cal = min(3, int(stage_y.value_counts().min()))
        if n_cal >= 2:
            model = CalibratedClassifierCV(base, method="isotonic", cv=n_cal)
            model.fit(stage_X, stage_y)
        else:
            model = base

        stage_models[stage.value] = model
        stage_metrics[stage.value] = {
            "n_samples": int(len(stage_rows)),
            "positive_rate": round(float(stage_y.mean()), 4),
            "trained": True,
            "calibrated": n_cal >= 2,
        }

    if not stage_models:
        return {
            "error": "Not enough labeled data per stage for per-stage classifiers",
            "fallback": True,
            "stage_metrics": stage_metrics,
        }

    return {
        "trained": True,
        "stage_models": stage_models,
        "stage_metrics": stage_metrics,
        "feature_columns": STAGE_FEATURE_COLS,
        "categorical_columns": STAGE_CATEGORICAL_COLS,
        "trained_at": datetime.utcnow().isoformat(),
    }


# ── Prediction ────────────────────────────────────────────────────────────────

def predict_stage_risks(session: Session, stage_model_bundle: dict | None = None) -> list[dict]:
    """Predict risk for every project at every lifecycle stage.

    Returns a list of dicts:
      project_id, project_name, stage, risk_score, risk_category,
      delay_probability, expected_completion_date, drivers, explanation
    """
    stage_df = build_stage_features(session)
    if stage_df.empty:
        return []

    # Build a project-name lookup
    project_names = {
        p.id: p.project_name
        for p in session.query(Project).all()
    }

    # Also build a stage_entered_at lookup for expected_completion_date computation
    # stage_entered_at is not in the feature table, so we pull it from DB
    stage_entered_lookup: dict[tuple, datetime | None] = {}
    for p in session.query(Project).all():
        for se in p.stage_events:
            stage_entered_lookup[(str(p.id), se.stage.value)] = se.entered_at

    if stage_model_bundle and stage_model_bundle.get("stage_models"):
        # Model-based scoring with merged rule-based drivers
        results = []
        for stage, model in stage_model_bundle["stage_models"].items():
            subset = stage_df[stage_df["stage"] == stage].copy()
            if subset.empty:
                continue
            X = _prep_stage_df(subset[STAGE_FEATURE_COLS])
            probs = model.predict_proba(X)[:, 1]
            for idx, (_, row) in enumerate(subset.iterrows()):
                delay_prob = float(probs[idx])
                score = round(delay_prob * 100, 2)
                entered_at = stage_entered_lookup.get((str(row["project_id"]), stage))
                results.append(
                    _format_stage_result(
                        row, score, project_names, delay_prob, entered_at,
                        days_since_notification=row.get("days_since_notification"),
                    )
                )
        return results

    # Fallback: rule-based stage risk scoring
    return _rule_based_stage_risks(stage_df, project_names, stage_entered_lookup)


# ── Rule-based fallback ───────────────────────────────────────────────────────

def _rule_based_stage_risks(
    stage_df: pd.DataFrame,
    project_names: dict,
    stage_entered_lookup: dict | None = None,
) -> list[dict]:
    """Rule-based stage risk when there is not enough data to train per-stage models."""
    results = []
    stage_entered_lookup = stage_entered_lookup or {}
    for _, row in stage_df.iterrows():
        score = 10.0  # base score

        if row["stage_overdue"]:
            score += 35.0
        if row["stage_overdue_days"]:
            score += min(20.0, float(row["stage_overdue_days"]) * 0.15)
        if row["stage_tenure_days"] and row["stage_tenure_days"] > 90:
            score += 15.0
        if row["open_legal_dispute_count"]:
            score += min(15.0, float(row["open_legal_dispute_count"]) * 5.0)
        if row["compensation_disbursement_pct"] is not None and row["compensation_disbursement_pct"] < 50:
            score += 15.0
        if row["rehabilitation_progress_pct"] is not None and row["rehabilitation_progress_pct"] < 50:
            score += 10.0
        if row["district_historical_delay_rate"] is not None:
            score += float(row["district_historical_delay_rate"]) * 20.0
        if row["agency_historical_delay_rate"] is not None:
            score += float(row["agency_historical_delay_rate"]) * 15.0

        score = max(0.0, min(100.0, score))
        delay_prob = round(score / 100, 4)
        entered_at = stage_entered_lookup.get((str(row["project_id"]), row["stage"]))
        results.append(
            _format_stage_result(
                row, score, project_names, delay_prob, entered_at,
                days_since_notification=row.get("days_since_notification"),
            )
        )
    return results


# ── Output formatting ─────────────────────────────────────────────────────────

def _format_stage_result(
    row,
    score: float,
    project_names: dict,
    delay_probability: float | None = None,
    stage_entered_at=None,
    days_since_notification=None,
) -> dict:
    """Format a stage risk result with human-readable explanation.

    delay_probability: direct model predict_proba output (0-1). Falls back to
                       score/100 if not provided (rule-based path).
    stage_entered_at:  datetime when this stage started — used to compute the
                       stage-specific expected completion date.
    expected_completion_date: stage_entered_at + STAGE_EXPECTED_DAYS[stage]
                              (NOT the overall project completion date).
    """
    category = "high" if score >= 70 else "medium" if score >= 40 else "low"

    # Drivers — always computed from rule signals so all paths have explanations
    drivers = []
    if row["stage_overdue"]:
        drivers.append("Stage is overdue")
    if row.get("stage_overdue_days") and float(row["stage_overdue_days"]) > 0:
        drivers.append(f"Overdue by {int(row['stage_overdue_days'])} days")
    if row.get("open_legal_dispute_count") and float(row["open_legal_dispute_count"]) > 0:
        drivers.append(f"{int(row['open_legal_dispute_count'])} open legal dispute(s)")
    if row.get("compensation_disbursement_pct") is not None and float(row["compensation_disbursement_pct"]) < 50:
        drivers.append(f"Compensation disbursed only {row['compensation_disbursement_pct']:.0f}%")
    if row.get("rehabilitation_progress_pct") is not None and float(row["rehabilitation_progress_pct"]) < 50:
        drivers.append(f"Rehabilitation progress only {row['rehabilitation_progress_pct']:.0f}%")
    if not drivers:
        drivers.append("No dominant delay driver identified")

    # Stage-specific expected completion date
    # Primary: stage_entered_at + STAGE_EXPECTED_DAYS[stage] (needs StageEvent records)
    # Fallback: notification_date + cumulative_stage_days (works for CSV-imported projects)
    stage_expected_completion = _stage_expected_completion(
        row["stage"], stage_entered_at,
        days_since_notification=days_since_notification or row.get("days_since_notification"),
    )

    # delay_probability: use direct model probability if available, else score/100
    dp = delay_probability if delay_probability is not None else round(float(score) / 100, 4)

    return {
        "project_id": row["project_id"],
        "project_name": project_names.get(row["project_id"], "Unknown"),
        "stage": row["stage"],
        "is_current_stage": bool(row["is_current_stage"]),
        "risk_score": round(float(score), 2),
        "risk_category": category,
        "delay_probability": round(float(dp), 4),
        "expected_completion_date": stage_expected_completion,     # Stage-specific
        "project_completion_date": str(row.get("expected_completion_date") or ""),  # Project-level (kept for reference)
        "drivers": drivers,
    }


# ── Summary ───────────────────────────────────────────────────────────────────

def get_stage_risk_summary(session: Session, stage_model_bundle: dict | None = None) -> dict:
    """Return a dashboard-friendly summary of stage risks."""
    results = predict_stage_risks(session, stage_model_bundle)
    if not results:
        return {"projects": [], "stages": {}, "high_risk_count": 0}

    summary = {}
    for stage in LifecycleStage:
        stage_results = [r for r in results if r["stage"] == stage.value]
        if not stage_results:
            continue
        scores = [r["risk_score"] for r in stage_results]
        probs  = [r["delay_probability"] for r in stage_results]
        summary[stage.value] = {
            "avg_risk_score": round(sum(scores) / len(scores), 2),
            "avg_delay_probability": round(sum(probs) / len(probs), 4),
            "high_risk_count": sum(1 for r in stage_results if r["risk_category"] == "high"),
            "project_count": len(stage_results),
        }

    return {
        "projects": results,
        "stages": summary,
        "high_risk_count": sum(1 for r in results if r["risk_category"] == "high"),
        "model_based": False,  # updated below if stage models were used
    }
