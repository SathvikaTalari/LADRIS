"""
Continuous learning pipeline.

The PS requires the system to "support continuous learning by updating
prediction models as new project data becomes available." This module:
1. Monitors model performance decay (drift detection)
2. Triggers automated retraining when needed
3. Maintains model version history with metadata
4. Supports incremental training with new data
5. Stores prediction history for performance tracking
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from app.db.init_db import SessionLocal
from app.db.schema import Project, RiskScore, IngestionLog
from app.ml.features import build_feature_table
from app.ml.evaluation import (
    compare_baseline, evaluate_with_cross_validation, run_full_evaluation,
)
from app.ml.model_store import load_model, save_model

DRIFT_THRESHOLD = 0.05       # 5% performance drop triggers retraining
MIN_NEW_PROJECTS = 5         # Minimum new projects before considering retraining
MAX_MODEL_AGE_DAYS = 30      # Retrain if model is older than this
MODELS_DIR = os.environ.get("MODELS_DIR", "models")


def get_model_age_days() -> int:
    """Get days since the latest model was trained."""
    try:
        from app.ml.model_store import get_latest_version
        version = get_latest_version()
        run_dir = os.path.join(MODELS_DIR, version)
        metadata_path = os.path.join(run_dir, "metadata.json")
        if os.path.exists(metadata_path):
            with open(metadata_path) as f:
                meta = json.load(f)
            training_ts = meta.get("training_timestamp", "")
            if training_ts:
                trained_dt = datetime.fromisoformat(training_ts)
                return (datetime.utcnow() - trained_dt).days
    except Exception:
        pass
    return 9999


def count_new_projects_since_last_training() -> int:
    """Count projects added since the latest model training."""
    try:
        from app.ml.model_store import get_latest_version
        version = get_latest_version()
        run_dir = os.path.join(MODELS_DIR, version)
        metadata_path = os.path.join(run_dir, "metadata.json")
        if os.path.exists(metadata_path):
            with open(metadata_path) as f:
                meta = json.load(f)
            training_ts = meta.get("training_timestamp", "")
            if training_ts:
                trained_dt = datetime.fromisoformat(training_ts)
                session = SessionLocal()
                try:
                    count = session.query(Project).filter(
                        Project.created_at >= trained_dt
                    ).count()
                    return count
                finally:
                    session.close()
    except Exception:
        pass
    return 0


def detect_drift(session: Session) -> dict[str, Any]:
    """Detect performance drift by comparing recent prediction accuracy
    against actual project outcomes, rather than just score averages.
    """
    try:
        from app.ml.model_store import get_latest_version, get_model_metadata
        version = get_latest_version()
        meta = get_model_metadata(version)
    except FileNotFoundError:
        return {"drift_detected": False, "reason": "No trained model found"}

    # We need projects that have a known outcome (is_delayed is not None)
    # AND a risk score from this model version.
    recent_projects = (
        session.query(Project, RiskScore)
        .join(RiskScore, Project.id == RiskScore.project_id)
        .filter(RiskScore.model_version == version)
        .filter(Project.is_delayed.isnot(None))
        .all()
    )

    if len(recent_projects) < 10:
        return {
            "drift_detected": False,
            "reason": "Insufficient known outcomes for current model version",
            "recent_count": len(recent_projects),
        }

    # Compute actual vs predicted
    y_true = []
    y_prob = []
    for proj, score in recent_projects:
        y_true.append(1 if proj.is_delayed else 0)
        y_prob.append(float(score.risk_score) / 100.0)

    from sklearn.metrics import roc_auc_score
    try:
        current_auc = roc_auc_score(y_true, y_prob)
    except ValueError:
        # Happens if only one class is present in the true labels
        return {"drift_detected": False, "reason": "Only one class present in recent outcomes"}

    expected_auc = 0.85 # fallback
    if "evaluation" in meta and "cross_validation" in meta["evaluation"]:
        expected_auc = meta["evaluation"]["cross_validation"].get("auc_roc", expected_auc)
    elif "classifier" in meta and "cross_validation" in meta["classifier"]:
        expected_auc = meta["classifier"]["cross_validation"].get("oof_auc_roc", expected_auc)

    drift_detected = (expected_auc - current_auc) > DRIFT_THRESHOLD

    return {
        "drift_detected": drift_detected,
        "model_version": version,
        "expected_auc": round(expected_auc, 4),
        "current_auc": round(current_auc, 4),
        "auc_drop": round(expected_auc - current_auc, 4),
        "recent_count": len(recent_projects),
        "threshold": DRIFT_THRESHOLD,
    }


def should_retrain() -> dict[str, Any]:
    """Determine if retraining is needed based on multiple signals."""
    age_days = get_model_age_days()
    new_projects = count_new_projects_since_last_training()
    session = SessionLocal()
    try:
        drift = detect_drift(session)
    finally:
        session.close()

    reasons = []
    if age_days > MAX_MODEL_AGE_DAYS:
        reasons.append(f"Model age ({age_days}d) exceeds {MAX_MODEL_AGE_DAYS}d threshold")
    if new_projects >= MIN_NEW_PROJECTS:
        reasons.append(f"{new_projects} new projects since last training (>= {MIN_NEW_PROJECTS})")
    if drift.get("drift_detected"):
        reasons.append(f"Performance drift detected (Δrisk={drift.get('risk_delta', 0):.2f})")

    return {
        "should_retrain": len(reasons) > 0,
        "reasons": reasons,
        "model_age_days": age_days,
        "new_projects_since_last": new_projects,
        "drift": drift,
        "thresholds": {
            "min_new_projects": MIN_NEW_PROJECTS,
            "max_model_age_days": MAX_MODEL_AGE_DAYS,
            "drift_threshold": DRIFT_THRESHOLD,
        },
    }


def run_continuous_training() -> dict[str, Any]:
    """Automated continuous training pipeline with quality gate.

    Checks if retraining is needed, evaluates a new model, and only promotes
    it to 'latest' if its cross-validated AUC is equal to or better than the
    current model's AUC (within a 1% margin).
    """
    decision = should_retrain()

    if not decision["should_retrain"]:
        return {
            "retraining_skipped": True,
            "reason": "No retraining needed at this time",
            "decision": decision,
        }

    # Backup current latest pointer
    pointer_path = os.path.join(MODELS_DIR, "latest.txt")
    current_version = None
    if os.path.exists(pointer_path):
        with open(pointer_path) as f:
            current_version = f.read().strip()

    # Get current model expected AUC
    current_auc = 0.0
    if current_version:
        try:
            from app.ml.model_store import get_model_metadata
            meta = get_model_metadata(current_version)
            if "evaluation" in meta and "cross_validation" in meta["evaluation"]:
                current_auc = meta["evaluation"]["cross_validation"].get("auc_roc", 0.0)
            elif "classifier" in meta and "cross_validation" in meta["classifier"]:
                current_auc = meta["classifier"]["cross_validation"].get("oof_auc_roc", 0.0)
        except Exception:
            pass

    # Run full evaluation and training (this automatically saves and updates latest.txt)
    metadata = run_full_evaluation()
    
    # Check new model AUC
    new_auc = 0.0
    if "evaluation" in metadata and "cross_validation" in metadata["evaluation"]:
        new_auc = metadata["evaluation"]["cross_validation"].get("auc_roc", 0.0)
    elif "classifier" in metadata and "cross_validation" in metadata["classifier"]:
        new_auc = metadata["classifier"]["cross_validation"].get("oof_auc_roc", 0.0)

    # Quality Gate
    # If the new model is worse than current model by more than 0.01 AUC, reject it
    promoted = True
    if current_version and new_auc < (current_auc - 0.01):
        promoted = False
        # Revert latest.txt pointer
        with open(pointer_path, "w") as f:
            f.write(current_version)

    metadata["continuous_learning"] = {
        "retraining_triggered": True,
        "reasons": decision["reasons"],
        "previous_model_age_days": decision["model_age_days"],
        "quality_gate_passed": promoted,
        "current_auc": current_auc,
        "new_auc": new_auc,
    }
    metadata["version"] = metadata.get("version", datetime.utcnow().strftime("%Y%m%d_%H%M%S"))

    return metadata


def get_training_history() -> list[dict]:
    """Get a list of all training runs with their metrics."""
    history = []
    if not os.path.exists(MODELS_DIR):
        return history

    for version in sorted(os.listdir(MODELS_DIR)):
        run_dir = os.path.join(MODELS_DIR, version)
        if not os.path.isdir(run_dir):
            continue

        metadata_path = os.path.join(run_dir, "metadata.json")
        if not os.path.exists(metadata_path):
            continue

        with open(metadata_path) as f:
            meta = json.load(f)

        history.append({
            "version": version,
            "feature_columns": meta.get("feature_columns", []),
            "categorical_columns": meta.get("categorical_columns", []),
            "has_regressor": meta.get("has_regressor"),
            "training_timestamp": meta.get("training_timestamp"),
            "evaluation": meta.get("evaluation", {}),
        })

    return history


def get_latest_evaluation() -> dict[str, Any] | None:
    """Get evaluation metrics for the latest model version."""
    history = get_training_history()
    if not history:
        return None
    return history[-1]
