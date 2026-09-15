"""Standalone smoke test for the latest ML model — no database required."""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import pandas as pd

from app.ml.model_store import load_model
from app.ml.predict import _risk_category


def make_row(**kwargs) -> dict:
    """Minimal feature row matching metadata.json columns."""
    defaults = dict(
        project_type="highway",
        state="UP",
        district="Lucknow",
        implementing_agency="NHAI",
        land_area_hectares=50.0,
        affected_families_count=200,
        days_since_notification=365,
        days_to_expected_completion=60,
        compensation_sanctioned=50_000_000.0,
        compensation_disbursed=10_000_000.0,
        compensation_disbursement_pct=20.0,
        days_since_last_disbursement=180,
        legal_dispute_count=3,
        open_legal_dispute_count=2,
        max_dispute_pendency_days=200,
        rehabilitation_progress_pct=10.0,
        resettlement_site_ready=False,
        stakeholder_update_count_90d=1,
        avg_days_between_updates=45.0,
        stage_count_recorded=4,
        current_stage="notification",
        district_historical_delay_rate=0.6,
        agency_historical_delay_rate=0.55,
    )
    defaults.update(kwargs)
    return defaults


def score_manually(bundle: dict, row: dict) -> dict:
    """Replicate the scoring logic from score_all_projects without a DB session."""
    classifier = bundle["classifier"]
    regressor = bundle["regressor"]
    feature_columns = bundle["feature_columns"]
    categorical_columns = bundle["categorical_columns"]

    X = pd.DataFrame([row])
    for col in feature_columns:
        if col in categorical_columns:
            X[col] = X[col].astype("category")
        else:
            X[col] = pd.to_numeric(X[col], errors="coerce")

    delay_probs = classifier.predict_proba(X)[:, 1]
    predicted_days = None
    if regressor is not None:
        predicted_days = np.clip(regressor.predict(X), 0, 2000)

    results = []
    for i in range(len(X)):
        score = float(delay_probs[i] * 100)
        results.append({
            "risk_score": round(score, 2),
            "risk_category": _risk_category(score).value,
            "predicted_delay_days": round(float(predicted_days[i]), 1) if predicted_days is not None else None,
        })
    return results[0]


def main():
    print("Loading latest model...")
    bundle = load_model()  # loads version in models/latest.txt
    print(f"Model version : {bundle['version']}")
    print(f"Training ts   : {bundle['training_timestamp']}")
    print(f"Classifier    : {type(bundle['classifier']).__name__}")
    print(f"Regressor     : {type(bundle['regressor']).__name__ if bundle['regressor'] else None}")
    print(f"Features      : {len(bundle['feature_columns'])} columns")
    print()

    # 1. High-risk case (low compensation, many disputes, high historical delay)
    high_risk = make_row(
        compensation_disbursement_pct=15.0,
        open_legal_dispute_count=5,
        max_dispute_pendency_days=400,
        district_historical_delay_rate=0.80,
        agency_historical_delay_rate=0.75,
        rehabilitation_progress_pct=5.0,
        days_since_last_disbursement=300,
    )
    # 2. Low-risk case (well disbursed, few disputes, low historical delay)
    low_risk = make_row(
        compensation_disbursement_pct=90.0,
        open_legal_dispute_count=0,
        max_dispute_pendency_days=0,
        district_historical_delay_rate=0.10,
        agency_historical_delay_rate=0.10,
        rehabilitation_progress_pct=95.0,
        days_since_last_disbursement=5,
        days_to_expected_completion=200,
    )

    print("=== Manual scoring ===")
    for label, row in [("HIGH-RISK scenario", high_risk), ("LOW-RISK scenario", low_risk)]:
        result = score_manually(bundle, row)
        print(f"\n{label}:")
        print(f"  risk_score        : {result['risk_score']}")
        print(f"  risk_category     : {result['risk_category']}")
        print(f"  predicted_delay_days : {result['predicted_delay_days']}")

    print("\n=== Model metadata ===")
    print(json.dumps(bundle.get("evaluation", {}), indent=2, default=str))

    print("\n[OK] Model loads and scores successfully.")


if __name__ == "__main__":
    main()
