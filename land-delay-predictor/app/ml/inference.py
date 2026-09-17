"""Pure, database-agnostic inference API for the production LADRIS bundle.

This module is the supported integration boundary for other applications.  It
uses the persisted model metadata, input validator, calibrated classifier,
quantile regressors, and SHAP-based recommendation policy already shipped in
this project.  It never trains or promotes a model.
"""
from __future__ import annotations

import time
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd
import shap

from .input_validation import REQUIRED_COLUMNS, validate_single_row
from .model_store import load_model

DEFAULT_RECOMMENDATION = "Maintain active statutory tracking; all project milestones are progressing within schedule."


def _rec(feature: str, value: Any) -> str:
    """Actionable recommendation policy derived directly from actual SHAP delay drivers."""
    if feature == "compensation_disbursement_pct":
        return f"Accelerate compensation disbursement; currently only {float(value):.1f}% disbursed to landowners."
    if feature == "open_legal_dispute_count":
        return f"Resolve or fast-track the {int(value)} active court dispute(s) stalling site handover."
    if feature == "max_dispute_pendency_days":
        return f"Oldest dispute has been pending for {int(value)} days; escalate for judicial hearing or Lok Adalat settlement."
    if feature == "rehabilitation_progress_pct":
        return f"Speed up R&R activities; progress is currently only {float(value):.1f}%."
    if feature == "resettlement_site_ready":
        return "Expedite resettlement site development and basic civic amenities for affected families."
    if feature == "days_since_notification":
        return f"Publish Section 19 declaration to prevent notification lapse ({int(value)} days elapsed since notification)."
    if feature == "days_to_expected_completion":
        d = int(value)
        if d < 0:
            return f"Project is {abs(d)} days past scheduled completion; trigger emergency executive review."
        return f"Only {d} days remain until scheduled completion; re-baseline critical path and clear pending approvals."
    if feature == "days_since_last_disbursement":
        return f"Investigate payment stall; no compensation disbursement recorded for {int(value)} days."
    if feature == "stakeholder_update_count_90d":
        return f"Enforce bi-weekly inter-agency reviews; only {int(value)} update(s) recorded in 90 days."
    if feature == "avg_days_between_updates":
        return f"Stakeholder updates average {float(value):.0f} days apart; mandate weekly progress submissions."
    if feature == "district_historical_delay_rate":
        return f"District historical delay rate is {float(value) * 100:.1f}%; deploy special district monitoring cell."
    if feature == "agency_historical_delay_rate":
        return f"Agency historical delay rate is {float(value) * 100:.1f}%; review execution bottlenecks with agency leadership."
    if feature == "legal_dispute_count":
        return f"{int(value)} cumulative disputes recorded; establish mediation cell to prevent future injunctions."
    if feature == "land_area_hectares":
        return f"Large land area ({float(value):.1f} ha); mobilize additional revenue survey teams for physical boundary demarcation."
    if feature == "affected_families_count":
        return f"{int(value)} affected families; assign dedicated R&R coordinators for family resettlement."
    if feature in ("compensation_sanctioned", "compensation_disbursed"):
        return "Expedite treasury release order for pending sanctioned compensation disbursement."
    return DEFAULT_RECOMMENDATION


@lru_cache(maxsize=1)
def get_bundle() -> dict[str, Any]:
    """Load production artifacts once per application process."""
    return load_model()


def warm_model() -> dict[str, Any]:
    bundle = get_bundle()
    return {"model_version": bundle["version"], "feature_columns": bundle["feature_columns"]}


def _frame(cleaned: dict[str, Any], bundle: dict[str, Any]) -> pd.DataFrame:
    columns = bundle["feature_columns"]
    if columns != REQUIRED_COLUMNS:
        raise ValueError(f"Model feature contract mismatch: metadata={columns}, validator={REQUIRED_COLUMNS}")
    frame = pd.DataFrame([{name: cleaned.get(name) for name in columns}], columns=columns)
    for column in columns:
        if column in bundle["categorical_columns"]:
            frame[column] = frame[column].astype("category")
        else:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")
    return frame


def _underlying_classifier(classifier: Any) -> Any:
    if hasattr(classifier, "calibrated_classifiers_"):
        return classifier.calibrated_classifiers_[0].estimator
    return classifier


def _drivers(classifier: Any, frame: pd.DataFrame, raw: dict[str, Any], limit: int = 5) -> list[dict[str, Any]]:
    explainer = shap.TreeExplainer(_underlying_classifier(classifier))
    values = explainer.shap_values(frame)
    if isinstance(values, list):
        values = values[1]
    row = np.asarray(values)[0]
    ranked = sorted(zip(frame.columns, row), key=lambda pair: abs(float(pair[1])), reverse=True)
    result = []
    for feature, contribution in ranked[:limit]:
        value = raw.get(feature)
        if pd.isna(value):
            value = None
        result.append({
            "feature": feature,
            "value": value.item() if hasattr(value, "item") else value,
            "contribution": round(float(contribution), 6),
            "direction": "increases_risk" if contribution > 0 else "decreases_risk",
            "recommendation": _rec(feature, value) if contribution > 0 and value is not None else None,
        })
    return result


def predict_features(features: dict[str, Any]) -> dict[str, Any]:
    """Validate and score one point-in-time, 23-feature snapshot."""
    started = time.perf_counter()
    features_copy = dict(features)
    allowed_stages = {"notification", "survey", "approval", "compensation", "legal_resolution", "rehabilitation", "possession", "completed"}
    c_stage = str(features_copy.get("current_stage") or "notification").strip().lower()
    features_copy["current_stage"] = c_stage if c_stage in allowed_stages else "notification"

    cleaned, validation = validate_single_row(features_copy, strict=True)
    if not validation.is_valid:
        raise ValueError("; ".join(validation.errors))

    bundle = get_bundle()
    frame = _frame(cleaned, bundle)
    probability = float(bundle["classifier"].predict_proba(frame)[0, 1])
    score = round(probability * 100.0, 2)
    low = float(bundle["risk_threshold_low"])
    high = float(bundle["risk_threshold_high"])
    category = "HIGH" if score >= high else "MEDIUM" if score >= low else "LOW"

    predicted = float(bundle["regressor"].predict(frame)[0]) if bundle.get("regressor") else None
    p10 = float(bundle["regressor_p10"].predict(frame)[0]) if bundle.get("regressor_p10") else None
    p90 = float(bundle["regressor_p90"].predict(frame)[0]) if bundle.get("regressor_p90") else None
    clamp = lambda value: None if value is None else round(float(np.clip(value, 0, 2000)), 2)
    drivers = _drivers(bundle["classifier"], frame, cleaned)

    lower_days = clamp(p10)
    upper_days = clamp(p90)
    delay_range = {
        "lower_days": lower_days,
        "upper_days": upper_days,
        "range_text": f"{int(lower_days or 0)} – {int(upper_days or 0)} days",
    }

    return {
        "model_version": bundle["version"],
        "delay_probability": round(probability, 6),
        "risk_score": score,
        "risk_category": category,
        "predicted_delay_days": clamp(predicted),
        "prediction_interval": {"p10": lower_days, "p90": upper_days},
        "delay_range": delay_range,
        "top_drivers": drivers,
        "recommendations": [d["recommendation"] for d in drivers if d["recommendation"]],
        "validation": validation.summary(),
        "latency_ms": round((time.perf_counter() - started) * 1000, 2),
    }


def predict_stages(features: dict[str, Any]) -> list[dict[str, Any]]:
    """Counterfactually score every lifecycle category with the production model.

    The active artifact does not contain standalone per-stage model files, so
    this method never claims that it does.
    """
    stages = ["notification", "survey", "approval", "compensation", "legal_resolution", "rehabilitation", "possession", "completed"]
    results = []
    for stage in stages:
        row = dict(features)
        row["current_stage"] = stage
        prediction = predict_features(row)
        results.append({
            "stage": stage,
            "delay_probability": prediction["delay_probability"],
            "risk_score": prediction["risk_score"],
            "risk_category": prediction["risk_category"],
            "prediction_method": "overall_model_stage_counterfactual",
        })
    return results


def model_info() -> dict[str, Any]:
    bundle = get_bundle()
    return {
        "model_version": bundle["version"],
        "model_type": "calibrated_lightgbm_classifier_and_quantile_regressors",
        "feature_columns": bundle["feature_columns"],
        "categorical_columns": bundle["categorical_columns"],
        "risk_thresholds": {"low_medium": bundle["risk_threshold_low"], "medium_high": bundle["risk_threshold_high"]},
        "training_timestamp": bundle["training_timestamp"],
        "evaluation": bundle["evaluation"],
        "data_hash": bundle["data_hash"],
    }
