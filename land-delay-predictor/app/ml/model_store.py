"""
Simple filesystem-based model versioning. One directory per training run
(models/<version>/), containing the classifier, regressor (if trained), and
the feature/categorical column lists needed to reconstruct the exact input
schema at inference time. `latest` is a pointer file, not a copy, so
`get_latest_version` always resolves to the most recent successful run.

Production additions:
  - training_seed stored in metadata for exact reproducibility
  - data_hash (SHA-256 of training DataFrame fingerprint) for auditability
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime
from typing import Any

import joblib
import lightgbm as lgb
import pandas as pd

MODELS_DIR = os.environ.get("MODELS_DIR", "models")
DEFAULT_TRAINING_SEED = 42


def compute_data_hash(df: pd.DataFrame) -> str:
    """Compute a SHA-256 fingerprint of a training DataFrame.

    Uses shape + column names + first/last 5 row hash so it's fast even on
    large DataFrames, yet sensitive to row-count changes and column drift.
    """
    shape_str = f"{df.shape[0]}x{df.shape[1]}"
    col_str   = ",".join(df.columns.tolist())
    # Sample hash: first 5 + last 5 rows stringified
    sample    = pd.concat([df.head(5), df.tail(5)]).to_csv(index=False)
    raw       = f"{shape_str}|{col_str}|{sample}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]  # 16-char prefix


def save_model(
    version: str,
    classifier: lgb.LGBMClassifier,
    regressor: lgb.LGBMRegressor | None,
    feature_columns: list[str],
    categorical_columns: list[str],
    evaluation: dict[str, Any] | None = None,
    training_seed: int = DEFAULT_TRAINING_SEED,
    training_df: pd.DataFrame | None = None,
    risk_threshold_low: float = 40.0,
    risk_threshold_high: float = 70.0,
) -> None:
    """Save a trained model version with all metadata.

    Args:
        training_seed:        The random_state used during training.
        training_df:          DataFrame used for training; SHA-256 stored for audit.
        risk_threshold_low:   OOF p33 score — boundary between LOW and MEDIUM.
        risk_threshold_high:  OOF p66 score — boundary between MEDIUM and HIGH.
    """
    run_dir = os.path.join(MODELS_DIR, version)
    os.makedirs(run_dir, exist_ok=True)

    joblib.dump(classifier, os.path.join(run_dir, "classifier.joblib"))
    if regressor is not None:
        joblib.dump(regressor, os.path.join(run_dir, "regressor.joblib"))

    data_hash = compute_data_hash(training_df) if training_df is not None else "unknown"

    metadata = {
        "feature_columns": feature_columns,
        "categorical_columns": categorical_columns,
        "has_regressor": regressor is not None,
        "training_timestamp": datetime.utcnow().isoformat(),
        "training_seed": training_seed,
        "data_hash": data_hash,
        "risk_threshold_low": risk_threshold_low,
        "risk_threshold_high": risk_threshold_high,
        "evaluation": evaluation or {},
    }

    with open(os.path.join(run_dir, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    with open(os.path.join(MODELS_DIR, "latest.txt"), "w") as f:
        f.write(version)


def get_latest_version() -> str:
    pointer_path = os.path.join(MODELS_DIR, "latest.txt")
    if not os.path.exists(pointer_path):
        raise FileNotFoundError("No trained model found. Run app/ml/train.py first.")
    with open(pointer_path) as f:
        return f.read().strip()


def load_model(version: str | None = None):
    """Load a model version and return the model bundle."""
    version = version or get_latest_version()
    run_dir = os.path.join(MODELS_DIR, version)

    classifier = joblib.load(os.path.join(run_dir, "classifier.joblib"))
    with open(os.path.join(run_dir, "metadata.json")) as f:
        metadata = json.load(f)

    regressor = None
    regressor_p10 = None
    regressor_p90 = None
    if metadata.get("has_regressor"):
        regressor = joblib.load(os.path.join(run_dir, "regressor.joblib"))
        p10_path = os.path.join(run_dir, "regressor_p10.joblib")
        if os.path.exists(p10_path):
            regressor_p10 = joblib.load(p10_path)
        p90_path = os.path.join(run_dir, "regressor_p90.joblib")
        if os.path.exists(p90_path):
            regressor_p90 = joblib.load(p90_path)

    return {
        "version": version,
        "classifier": classifier,
        "regressor": regressor,
        "regressor_p10": regressor_p10,
        "regressor_p90": regressor_p90,
        "feature_columns": metadata["feature_columns"],
        "categorical_columns": metadata["categorical_columns"],
        "evaluation": metadata.get("evaluation", {}),
        "training_timestamp": metadata.get("training_timestamp"),
        "training_seed": metadata.get("training_seed", DEFAULT_TRAINING_SEED),
        "data_hash": metadata.get("data_hash", "unknown"),
        # Adaptive risk thresholds (fallback to fixed defaults for old model versions)
        "risk_threshold_low":  metadata.get("risk_threshold_low", 40.0),
        "risk_threshold_high": metadata.get("risk_threshold_high", 70.0),
    }


def get_model_metadata(version: str | None = None) -> dict:
    """Get metadata for a model version without loading the model."""
    version = version or get_latest_version()
    run_dir = os.path.join(MODELS_DIR, version)
    metadata_path = os.path.join(run_dir, "metadata.json")

    if not os.path.exists(metadata_path):
        raise FileNotFoundError(f"No metadata for model version {version}")

    with open(metadata_path) as f:
        return json.load(f)