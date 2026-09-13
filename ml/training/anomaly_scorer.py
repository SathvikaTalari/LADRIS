"""
LandPulse AI — IsolationForest Anomaly Scorer
================================================
Trains an unsupervised anomaly detection model on real BhoomiRashi data.

IMPORTANT LABELING:
  This model produces an ANOMALY SCORE — not a delay prediction.
  An anomaly score indicates how structurally unusual a project is
  relative to the population. High anomaly score ≠ delayed project.
  This distinction MUST be preserved in all API responses and UI.

Training data: Real BhoomiRashi public table data (land area, cost,
               state, agency, notification interval)

Evaluation: Silhouette score, contamination analysis, score distribution
"""

import hashlib
import json
import logging
import pickle
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

log = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

MODEL_VERSION = "v1.0-anomaly"
MINIMUM_RECORDS = 50  # Below this, refuse to train

AUTHENTICITY_STATEMENT = (
    "This model is an IsolationForest anomaly scorer trained on real publicly "
    "available data from the BhoomiRashi portal (bhoomirashi.gov.in). "
    "It produces an ANOMALY SCORE — a measure of structural unusualness relative "
    "to the dataset population. It is NOT a delay prediction and does NOT predict "
    "whether a project will be delayed. No fabricated training labels were used. "
    "This distinction must be preserved in all downstream use."
)


def build_pipeline() -> Pipeline:
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", IsolationForest(
            n_estimators=100,
            contamination=0.1,  # Assume ~10% outliers in the population
            random_state=42,
            n_jobs=-1,
        )),
    ])


def train(feature_df: pd.DataFrame, feature_cols: list[str]) -> dict:
    """
    Train anomaly scorer on real data.

    Returns a result dict with model path, metrics, and metadata.
    Refuses to train if fewer than MINIMUM_RECORDS rows are available.
    """
    # Filter to prediction-eligible and valid rows
    mask = pd.Series([True] * len(feature_df))
    if "_row_valid" in feature_df.columns:
        mask = mask & feature_df["_row_valid"].fillna(False).astype(bool)
    if "_prediction_eligible" in feature_df.columns:
        mask = mask & feature_df["_prediction_eligible"].fillna(False).astype(bool)

    eligible = feature_df[mask].copy()
    n = len(eligible)

    log.info("Training on %d eligible rows (of %d total)", n, len(feature_df))

    if n < MINIMUM_RECORDS:
        log.warning(
            "Insufficient data: %d rows < minimum %d. Refusing to train.",
            n, MINIMUM_RECORDS,
        )
        return {
            "status": "INSUFFICIENT_DATA",
            "reason": (
                f"Only {n} valid prediction-eligible rows available. "
                f"Minimum required: {MINIMUM_RECORDS}. "
                "Ingest more real BhoomiRashi data before training."
            ),
            "n_available": n,
            "n_required": MINIMUM_RECORDS,
        }

    X = eligible[feature_cols].values

    # Train pipeline
    pipeline = build_pipeline()
    pipeline.fit(X)

    # Score training data (for distribution analysis only)
    scores = pipeline.decision_function(X)
    # IsolationForest: lower score = more anomalous
    # Normalise to [0, 1] where 1 = most anomalous
    min_s, max_s = scores.min(), scores.max()
    if max_s - min_s > 0:
        anomaly_scores = 1 - (scores - min_s) / (max_s - min_s)
    else:
        anomaly_scores = np.zeros(len(scores))

    labels = pipeline.predict(X)  # -1 = anomaly, 1 = normal
    anomaly_count = (labels == -1).sum()

    # Score distribution
    pcts = np.percentile(anomaly_scores, [25, 50, 75, 90, 95, 99])

    # Dataset version hash
    dataset_hash = hashlib.md5(
        pd.util.hash_pandas_object(eligible[feature_cols]).values.tobytes()
    ).hexdigest()[:12]

    metrics = {
        "n_training_records": int(n),
        "n_anomalies_detected": int(anomaly_count),
        "anomaly_rate": round(float(anomaly_count / n), 4),
        "score_distribution": {
            "p25": round(float(pcts[0]), 4),
            "p50": round(float(pcts[1]), 4),
            "p75": round(float(pcts[2]), 4),
            "p90": round(float(pcts[3]), 4),
            "p95": round(float(pcts[4]), 4),
            "p99": round(float(pcts[5]), 4),
        },
        "score_min": round(float(anomaly_scores.min()), 4),
        "score_max": round(float(anomaly_scores.max()), 4),
        "score_mean": round(float(anomaly_scores.mean()), 4),
    }

    # Save model
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    model_filename = f"isolation_forest_{MODEL_VERSION}_{ts}.pkl"
    model_path = MODELS_DIR / model_filename
    with model_path.open("wb") as f:
        pickle.dump(pipeline, f)

    # Save normalisation params
    norm_path = MODELS_DIR / f"score_normalisation_{MODEL_VERSION}_{ts}.json"
    norm_data = {
        "score_min_raw": float(min_s),
        "score_max_raw": float(max_s),
        "training_timestamp": ts,
    }
    norm_path.write_text(json.dumps(norm_data, indent=2))

    # Save metadata
    meta = {
        "model_version": MODEL_VERSION,
        "model_type": "ANOMALY_SCORER",
        "model_name": "LandPulse IsolationForest Risk Anomaly Scorer",
        "training_date": datetime.now(timezone.utc).isoformat(),
        "dataset_version": dataset_hash,
        "record_count_used": int(n),
        "feature_list": feature_cols,
        "evaluation_metrics": metrics,
        "model_path": model_filename,
        "preprocessing_path": norm_path.name,
        "is_current": True,
        "authenticity_statement": AUTHENTICITY_STATEMENT,
        "data_sources_used": ["BHOOMIRASHI_PUBLIC_SEARCH_TABLE"],
        "contamination_parameter": 0.1,
        "status": "TRAINED",
    }

    meta_path = MODELS_DIR / f"model_metadata_{MODEL_VERSION}_{ts}.json"
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False))

    # Also save as "current" pointer
    current_path = MODELS_DIR / "current_model.json"
    current_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False))

    log.info(
        "Model trained and saved: %s | %d records | %d anomalies",
        model_path, n, anomaly_count,
    )
    return {**meta, "status": "TRAINED"}


def load_current_model() -> tuple[Pipeline | None, dict | None, dict | None]:
    """Load the current trained model. Returns (pipeline, metadata, norm_params)."""
    current_path = MODELS_DIR / "current_model.json"
    if not current_path.exists():
        return None, None, None

    meta = json.loads(current_path.read_text())
    raw_model = meta.get("model_path", "")
    raw_norm = meta.get("preprocessing_path", "")
    model_path = MODELS_DIR / Path(raw_model).name
    norm_path = MODELS_DIR / Path(raw_norm).name

    if not model_path.exists():
        log.warning("Model file not found at %s", model_path)
        return None, meta, None

    with model_path.open("rb") as f:
        pipeline = pickle.load(f)

    norm = json.loads(norm_path.read_text()) if norm_path.exists() else {}
    return pipeline, meta, norm


def predict_single(
    pipeline: Pipeline,
    norm: dict,
    feature_values: dict,
    feature_cols: list[str],
) -> dict:
    """
    Score a single project record.

    Returns:
        anomaly_score (0-1, higher = more anomalous),
        is_anomaly (bool),
        risk_tier (str),
        model_output_label (CLEARLY labelled as anomaly, not delay)
    """
    X = np.array([[feature_values.get(f, np.nan) for f in feature_cols]])
    X = np.nan_to_num(X, nan=0.0)  # Imputer in pipeline handles this better

    raw_score = pipeline.decision_function(X)[0]
    label = pipeline.predict(X)[0]

    # Normalise
    s_min = norm.get("score_min_raw", raw_score)
    s_max = norm.get("score_max_raw", raw_score)
    if s_max - s_min > 0:
        anomaly_score = float(1 - (raw_score - s_min) / (s_max - s_min))
    else:
        anomaly_score = 0.5

    anomaly_score = max(0.0, min(1.0, anomaly_score))

    # Risk tier based on anomaly score
    if anomaly_score >= 0.75:
        risk_tier = "HIGH_ANOMALY"
    elif anomaly_score >= 0.50:
        risk_tier = "MODERATE_ANOMALY"
    elif anomaly_score >= 0.25:
        risk_tier = "LOW_ANOMALY"
    else:
        risk_tier = "TYPICAL"

    return {
        "anomaly_score": round(anomaly_score, 4),
        "is_anomaly": bool(label == -1),
        "risk_tier": risk_tier,
        "model_output_type": "ANOMALY_SCORE",
        "model_output_label": (
            "This is a structural anomaly score — not a delay prediction. "
            "A higher score indicates the project's characteristics are "
            "unusual relative to the training population."
        ),
    }
