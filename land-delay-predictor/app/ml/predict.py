"""
Scores canonical projects using the latest (or a specified) trained model.
Produces, per project: a 0-100 risk score, a low/medium/high category, an
optional predicted delay duration, the top SHAP-ranked drivers, and templated
recommendations derived from those drivers — which is the "actionable
recommendations" piece the PS asks for, kept as a thin rule layer on top of
real SHAP output rather than a second black-box model.

v2 improvements:
  - Dynamic recommendations that embed actual feature values
    (e.g. "Compensation disbursement is only 23% — escalate funds immediately")
  - Confidence interval from regressor (min/max predicted delay range)
  - Additional driver mappings for all feature engineering fields
  - Graceful SHAP fallback when tree explainer fails
"""
from __future__ import annotations

import json
import uuid
import warnings
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd
import shap

# Suppress SHAP's informational warning about LightGBM binary classifier output
# format (list of ndarray). This is expected behaviour with LightGBM 4.7+ and
# does not affect correctness — the warning going to stderr causes PowerShell
# to report a non-zero exit code even when the pipeline succeeds.
warnings.filterwarnings(
    "ignore",
    message="LightGBM binary classifier with TreeExplainer shap values output has changed",
    category=UserWarning,
    module="shap",
)

from sqlalchemy.orm import Session

from app.db.schema import RiskCategory, RiskScore
from app.ml.features import build_feature_table
from app.ml.model_store import load_model, get_model_metadata
from app.ml.input_validation import validate_and_clean

DEFAULT_RECOMMENDATION = (
    "Maintain active statutory tracking; all project milestones are progressing within schedule."
)


def _risk_category(
    score: float,
    threshold_low: float = 40.0,
    threshold_high: float = 70.0,
) -> RiskCategory:
    """Classify a 0-100 risk score into LOW / MEDIUM / HIGH.

    Uses adaptive thresholds stored in the model bundle (computed from OOF
    predictions at training time). Falls back to fixed defaults for old
    models that predate this feature.
    """
    if score >= threshold_high:
        return RiskCategory.HIGH
    if score >= threshold_low:
        return RiskCategory.MEDIUM
    return RiskCategory.LOW


# ── Dynamic Recommendation Templates ─────────────────────────────────────────
# Each entry is (label, template_fn) where template_fn(value) produces a
# context-aware recommendation string. value is the raw feature value for that row.

def _rec_compensation_pct(v) -> str:
    pct = round(float(v), 1) if v is not None else "?"
    if pct < 30:
        return (f"Compensation disbursement is critically low at {pct}%. "
                "Immediately release blocked funds to prevent further escalations.")
    if pct < 60:
        return (f"Compensation disbursement at {pct}% — expedite release of the "
                "remaining sanctioned amount to affected families.")
    return (f"Compensation disbursement at {pct}% — complete final disbursement "
            "tranche to close this risk factor.")


def _rec_open_disputes(v) -> str:
    count = int(v) if v is not None else 0
    if count == 1:
        return ("1 open legal dispute pending. Coordinate with the concerned court "
                "for early resolution or out-of-court settlement.")
    return (f"{count} open legal disputes pending. Initiate parallel resolution "
            "mechanisms and assign a dedicated legal monitoring team.")


def _rec_dispute_pendency(v) -> str:
    days = int(v) if v is not None else 0
    return (f"Oldest open legal dispute has been pending for {days} days. "
            f"Flag for administrative or judicial fast-tracking via Lok Adalat.")


def _rec_rehab_pct(v) -> str:
    pct = round(float(v), 1) if v is not None else "?"
    if pct < 30:
        return (f"Rehabilitation & Resettlement progress is critically low at {pct}%. "
                "Immediately allocate R&R staff and expedite resettlement site readiness.")
    return (f"R&R progress at {pct}% — accelerate family relocation and site "
            "infrastructure completion to unblock possession.")


def _rec_district_rate(v) -> str:
    rate = round(float(v) * 100, 1) if v is not None else "?"
    return (f"This district has a {rate}% historical delay rate. "
            "Apply district-specific contingency measures and increase monitoring frequency.")


def _rec_agency_rate(v) -> str:
    rate = round(float(v) * 100, 1) if v is not None else "?"
    return (f"The implementing agency has a {rate}% historical delay rate. "
            "Review agency-level process bottlenecks and escalate to senior officials.")


def _rec_update_gap(v) -> str:
    days = round(float(v), 0) if v is not None else "?"
    return (f"Average {days} days between stakeholder updates — significantly above acceptable cadence. "
            "Mandate weekly status updates from the responsible district officer.")


def _rec_disbursement_stalled(v) -> str:
    days = int(v) if v is not None else "?"
    return (f"No compensation disbursement activity in the last {days} days. "
            "Investigate reason for stall and escalate to disbursing authority.")


def _rec_families(v) -> str:
    count = int(v) if v is not None else "?"
    return (f"Project affects {count} families — large scale increases coordination complexity. "
            "Ensure dedicated R&R coordinator is assigned and tracking is granular.")


def _rec_days_to_completion(v) -> str:
    days = int(v) if v is not None else 0
    if days < 0:
        return (f"Project is {abs(days)} days past expected completion. "
                "Trigger escalation protocol and issue formal delay report.")
    if days < 30:
        return (f"Only {days} days remain before expected completion. "
                "Conduct emergency status review and risk assessment immediately.")
    return (f"Project is {days} days from expected completion. "
            "Maintain current monitoring cadence and resolve open blockers.")


DRIVER_INFO: dict[str, tuple[str, callable]] = {
    "compensation_disbursement_pct": (
        "Low compensation disbursement",
        _rec_compensation_pct,
    ),
    "open_legal_dispute_count": (
        "Open legal disputes",
        _rec_open_disputes,
    ),
    "max_dispute_pendency_days": (
        "Long-pending legal dispute",
        _rec_dispute_pendency,
    ),
    "rehabilitation_progress_pct": (
        "Slow rehabilitation & resettlement progress",
        _rec_rehab_pct,
    ),
    "district_historical_delay_rate": (
        "High district historical delay rate",
        _rec_district_rate,
    ),
    "agency_historical_delay_rate": (
        "High agency historical delay rate",
        _rec_agency_rate,
    ),
    "avg_days_between_updates": (
        "Low stakeholder responsiveness",
        _rec_update_gap,
    ),
    "days_since_last_disbursement": (
        "Stalled compensation disbursement",
        _rec_disbursement_stalled,
    ),
    "affected_families_count": (
        "Large number of affected families",
        _rec_families,
    ),
    "days_to_expected_completion": (
        "Approaching or past expected completion",
        _rec_days_to_completion,
    ),
    "legal_dispute_count": (
        "History of legal disputes",
        lambda v: (
            f"{int(v) if v else 0} total legal disputes recorded on this project. "
            "Ensure all past cases are formally closed and filed correctly."
        ),
    ),
    "land_area_hectares": (
        "Large land area involved",
        lambda v: (
            f"Project involves {round(float(v), 1) if v else '?'} ha of land acquisition — "
            "large area increases documentation and survey complexity."
        ),
    ),
    "days_since_notification": (
        "Extended time since notification",
        lambda v: (
            f"Project has been active for {int(v) if v else '?'} days since notification. "
            "Extended timelines indicate systemic delays — review at division level."
        ),
    ),
    "stakeholder_update_count_90d": (
        "Low stakeholder update frequency",
        lambda v: (
            f"Only {int(v) if v else 0} stakeholder updates in the last 90 days. "
            "Mandate bi-weekly update submissions from all stakeholder agencies."
        ),
    ),
    "compensation_sanctioned": (
        "Compensation sanctioned but not released",
        lambda v: (
            f"₹{int(float(v) / 1e6) if v else '?'}M sanctioned — verify release order "
            "clearance and escalate any treasury or finance department bottlenecks."
        ),
    ),
    "compensation_disbursed": (
        "Low absolute compensation disbursed",
        lambda v: (
            f"Only ₹{int(float(v) / 1e6) if v else '?'}M disbursed so far. "
            "Escalate release of pending sanctioned funds."
        ),
    ),
}


def _safe_feature_value(val):
    """Return val as float for numerics, str for categoricals, None for NaN/missing."""
    if val is None:
        return None
    if isinstance(val, str):
        return val  # categorical — keep as-is (e.g. 'HMDA', 'highway', 'Lucknow')
    try:
        f = float(val)
        return None if f != f else f  # NaN check
    except (TypeError, ValueError):
        return str(val)


def _top_drivers(
    shap_values_row: np.ndarray,
    feature_names: list[str],
    feature_values: dict,
    top_n: int = 3,
) -> list[dict]:
    pairs = sorted(
        zip(feature_names, shap_values_row),
        key=lambda x: abs(x[1]),
        reverse=True,
    )
    drivers = []
    for name, shap_val in pairs[:top_n]:
        if abs(shap_val) < 1e-6:
            continue
        raw_val = feature_values.get(name)
        if name in DRIVER_INFO:
            label, rec_fn = DRIVER_INFO[name]
            try:
                recommendation = rec_fn(raw_val)
            except Exception:
                recommendation = DEFAULT_RECOMMENDATION
        else:
            label = name.replace("_", " ").title()
            recommendation = DEFAULT_RECOMMENDATION

        drivers.append({
            "feature": name,
            "shap_impact": round(float(shap_val), 4),
            "feature_value": _safe_feature_value(raw_val),
            "label": label,
            "recommendation": recommendation,
        })
    return drivers


def _get_lgbm_from_classifier(classifier):
    """
    Unwrap a (possibly CalibratedClassifierCV-wrapped) classifier to get the
    underlying LightGBM model for SHAP TreeExplainer.

    CalibratedClassifierCV holds N copies of the estimator (one per CV fold).
    We use the first one for SHAP — all have the same feature space.
    """
    # Check if it's a calibrated wrapper
    if hasattr(classifier, "calibrated_classifiers_"):
        # Each calibrated_classifiers_ item has a .estimator attribute
        return classifier.calibrated_classifiers_[0].estimator
    return classifier


def _compute_shap_values(classifier, X: pd.DataFrame):
    """Compute SHAP values with fallback for edge cases.

    Handles CalibratedClassifierCV by extracting the underlying LGBM model.
    """
    lgbm_model = _get_lgbm_from_classifier(classifier)
    try:
        explainer = shap.TreeExplainer(lgbm_model)
        shap_values = explainer.shap_values(X)
        # LightGBM binary: shap_values is 2D array for positive class in recent SHAP
        if isinstance(shap_values, list):
            return shap_values[1]
        return shap_values
    except Exception:
        # Fallback: use feature importances as proxy SHAP values (normalised)
        if hasattr(lgbm_model, "feature_importances_"):
            importances = lgbm_model.feature_importances_
        else:
            importances = np.ones(X.shape[1])
        total = importances.sum() or 1.0
        normalized = importances / total
        return np.tile(normalized, (len(X), 1))


def score_all_projects(session: Session, model_version: str | None = None) -> list[RiskScore]:
    import traceback
    
    bundle = load_model(model_version)
    classifier = bundle["classifier"]
    regressor = bundle["regressor"]
    reg_p10 = bundle.get("regressor_p10")
    reg_p90 = bundle.get("regressor_p90")
    feature_columns = bundle["feature_columns"]
    categorical_columns = bundle["categorical_columns"]
    threshold_low  = bundle.get("risk_threshold_low", 40.0)
    threshold_high = bundle.get("risk_threshold_high", 70.0)

    raw_df = build_feature_table(session)
    if raw_df.empty:
        return []

    # Validate inputs (clamps out-of-range values to prevent absurd predictions)
    df, validation_res = validate_and_clean(raw_df, strict=False)

    X = df[feature_columns].copy()
    for col in feature_columns:
        if col in categorical_columns:
            X[col] = X[col].astype("category")
        else:
            X[col] = pd.to_numeric(X[col], errors="coerce")

    delay_probs = classifier.predict_proba(X)[:, 1]

    predicted_days: Optional[np.ndarray] = None
    predicted_days_p10: Optional[np.ndarray] = None
    predicted_days_p90: Optional[np.ndarray] = None

    if regressor is not None:
        predicted_days = regressor.predict(X)
        predicted_days = np.clip(predicted_days, 0, 2000)
    
    if reg_p10 is not None and reg_p90 is not None:
        predicted_days_p10 = reg_p10.predict(X)
        predicted_days_p90 = reg_p90.predict(X)
        predicted_days_p10 = np.clip(predicted_days_p10, 0, 2000)
        predicted_days_p90 = np.clip(predicted_days_p90, 0, 2000)

    shap_matrix = _compute_shap_values(classifier, X)

    saved: list[RiskScore] = []
    for i, (_, row) in enumerate(df.iterrows()):
        try:
            score = float(delay_probs[i] * 100)
            feature_values = row[feature_columns].to_dict()
            drivers = _top_drivers(shap_matrix[i], feature_columns, feature_values)
            recommendations = [d["recommendation"] for d in drivers] or [DEFAULT_RECOMMENDATION]

            risk_score = RiskScore(
                id=str(uuid.uuid4()),
                project_id=row["project_id"],
                predicted_at=datetime.utcnow(),
                model_version=bundle["version"],
                risk_score=round(score, 2),
                risk_category=_risk_category(score, threshold_low, threshold_high),
                predicted_delay_days=float(predicted_days[i]) if predicted_days is not None else None,
                predicted_delay_days_p10=float(predicted_days_p10[i]) if predicted_days_p10 is not None else None,
                predicted_delay_days_p90=float(predicted_days_p90[i]) if predicted_days_p90 is not None else None,
                top_drivers_json=json.dumps(drivers),
                recommendations_json=json.dumps(recommendations),
            )
            session.add(risk_score)
            saved.append(risk_score)
        except Exception as e:
            print(f"Failed to score project {row.get('project_id')}: {e}")
            traceback.print_exc()
            # Continue scoring other projects

    session.commit()
    return saved


def get_global_shap_summary(session: Session, model_version: str | None = None) -> dict:
    """Returns global SHAP feature importances for a trained model."""
    meta = get_model_metadata(model_version)
    if "evaluation" in meta and "train_metrics" in meta["evaluation"]:
        # If we had stored global SHAP in training metrics, we could just return it.
        # But we didn't, so we'll compute it on the current canonical features.
        pass

    bundle = load_model(model_version)
    classifier = bundle["classifier"]
    feature_columns = bundle["feature_columns"]
    categorical_columns = bundle["categorical_columns"]

    raw_df = build_feature_table(session)
    if raw_df.empty:
        return {"error": "No data available to compute global SHAP"}

    df, _ = validate_and_clean(raw_df, strict=False)
    X = df[feature_columns].copy()
    for col in feature_columns:
        if col in categorical_columns:
            X[col] = X[col].astype("category")
        else:
            X[col] = pd.to_numeric(X[col], errors="coerce")

    shap_matrix = _compute_shap_values(classifier, X)
    mean_abs_shap = np.abs(shap_matrix).mean(axis=0)

    importances = sorted(
        zip(feature_columns, mean_abs_shap),
        key=lambda x: x[1],
        reverse=True
    )

    formatted = []
    for feat, imp in importances:
        if imp < 1e-5: continue
        label = DRIVER_INFO.get(feat, (feat.replace("_", " ").title(), None))[0]
        formatted.append({
            "feature": feat,
            "label": label,
            "mean_abs_shap": round(float(imp), 4)
        })

    return {
        "model_version": bundle["version"],
        "n_projects_analyzed": len(df),
        "global_importances": formatted,
    }
