"""Predict land acquisition delay for new data using the latest trained model.

Usage:
    python predict_new.py path/to/new_projects.csv

The CSV must contain the 23 engineered features listed in models/latest.txt's
feature_columns. Each row is scored independently.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import argparse
import numpy as np
import pandas as pd

from app.ml.model_store import load_model
from app.ml.predict import _risk_category


REQUIRED_COLUMNS = [
    "project_type",
    "state",
    "district",
    "implementing_agency",
    "land_area_hectares",
    "affected_families_count",
    "days_since_notification",
    "days_to_expected_completion",
    "compensation_sanctioned",
    "compensation_disbursed",
    "compensation_disbursement_pct",
    "days_since_last_disbursement",
    "legal_dispute_count",
    "open_legal_dispute_count",
    "max_dispute_pendency_days",
    "rehabilitation_progress_pct",
    "resettlement_site_ready",
    "stakeholder_update_count_90d",
    "avg_days_between_updates",
    "stage_count_recorded",
    "current_stage",
    "district_historical_delay_rate",
    "agency_historical_delay_rate",
]

CATEGORICAL_COLUMNS = [
    "project_type",
    "state",
    "district",
    "implementing_agency",
    "current_stage",
]


def predict_with_model(bundle: dict, df: pd.DataFrame) -> list[dict]:
    classifier = bundle["classifier"]
    regressor = bundle["regressor"]
    feature_columns = bundle["feature_columns"]
    categorical_columns = bundle["categorical_columns"]
    threshold_low  = bundle.get("risk_threshold_low", 40.0)
    threshold_high = bundle.get("risk_threshold_high", 70.0)

    X = df[feature_columns].copy()
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
            "risk_category": _risk_category(score, threshold_low, threshold_high).value,
            "predicted_delay_days": round(float(predicted_days[i]), 1) if predicted_days is not None else None,
        })
    return results


def main():
    parser = argparse.ArgumentParser(description="Predict land acquisition delay using the trained model.")
    parser.add_argument("csv", help="Path to a CSV containing the 23 engineered features.")
    parser.add_argument("--version", default=None, help="Explicit model version (default: latest).")
    args = parser.parse_args()

    print(f"Loading model version: {args.version or 'latest'}")
    bundle = load_model(args.version)
    print(f"Model version  : {bundle['version']}")
    print(f"Training ts    : {bundle['training_timestamp']}")
    t_low  = bundle.get('risk_threshold_low', 40.0)
    t_high = bundle.get('risk_threshold_high', 70.0)
    print(f"Thresholds     : LOW < {t_low} <= MEDIUM < {t_high} <= HIGH")
    print()

    if not os.path.exists(args.csv):
        print(f"Error: CSV file not found: {args.csv}")
        sys.exit(1)

    df = pd.read_csv(args.csv)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        print(f"Error: CSV is missing required feature columns: {missing}")
        sys.exit(1)

    print(f"Scoring {len(df)} project(s)...")
    print()

    results = predict_with_model(bundle, df)

    for idx, (_, row) in enumerate(df.iterrows()):
        r = results[idx]
        project_label = row.get("project_id", row.get("Project ID", f"Row {idx + 1}"))
        print(f"Project: {project_label}")
        print(f"  Risk Score        : {r['risk_score']}")
        print(f"  Risk Category     : {r['risk_category']}")
        print(f"  Predicted Delay   : {r['predicted_delay_days']} days")
        print()

    # Summary
    high = sum(1 for r in results if r["risk_category"] == "high")
    medium = sum(1 for r in results if r["risk_category"] == "medium")
    low = sum(1 for r in results if r["risk_category"] == "low")
    print("Summary:")
    print(f"  HIGH risk: {high}")
    print(f"  MEDIUM risk: {medium}")
    print(f"  LOW risk: {low}")


if __name__ == "__main__":
    main()
