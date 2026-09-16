# -*- coding: utf-8 -*-
"""
LADRIS ML Model - Comprehensive Verification Suite
====================================================
Run this BEFORE connecting the model to your frontend/backend.

Tests covered:
  1. Model load & metadata check
  2. Prediction sanity (HIGH risk > LOW risk score)
  3. SHAP explanations & driver extraction
  4. Stage-specific risk scoring
  5. Continuous learning trigger logic
  6. Alert generation logic
  7. API endpoint smoke tests (requires running server)
  8. Performance metrics summary

Usage:
    # Full test (no server needed):
    python verify_model.py

    # Include live API tests (start server first):
    python verify_model.py --api-url http://localhost:8000

    # Quick model-only check:
    python verify_model.py --quick
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import pandas as pd

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

PASS = f"{GREEN}[PASS]{RESET}"
FAIL = f"{RED}[FAIL]{RESET}"
WARN = f"{YELLOW}[WARN]{RESET}"
INFO = f"{CYAN}[INFO]{RESET}"

results: list[dict] = []


def check(name: str, passed: bool, detail: str = "", warn: bool = False):
    tag = WARN if warn else (PASS if passed else FAIL)
    status = "WARN" if warn else ("PASS" if passed else "FAIL")
    print(f"  {tag}  {name}")
    if detail:
        print(f"        => {detail}")
    results.append({"test": name, "status": status, "detail": detail})


def section(title: str):
    print(f"\n{BOLD}{CYAN}" + "-"*60 + f"{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}" + "-"*60 + f"{RESET}")


# ── Feature row builder ───────────────────────────────────────────────────────
def make_row(**kwargs) -> dict:
    defaults = dict(
        project_type="highway",
        state="Uttar Pradesh",
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


def score_row(bundle: dict, row: dict) -> dict:
    """Score a single feature row without a DB session."""
    from app.ml.predict import _risk_category
    classifier = bundle["classifier"]
    regressor  = bundle["regressor"]
    feature_columns     = bundle["feature_columns"]
    categorical_columns = bundle["categorical_columns"]

    X = pd.DataFrame([row])
    for col in feature_columns:
        if col in categorical_columns:
            X[col] = X[col].astype("category")
        else:
            X[col] = pd.to_numeric(X[col], errors="coerce")

    delay_prob = float(classifier.predict_proba(X)[0, 1])
    score = round(delay_prob * 100, 2)

    predicted_days = None
    if regressor is not None:
        predicted_days = round(float(np.clip(regressor.predict(X)[0], 0, 2000)), 1)

    return {
        "risk_score": score,
        "risk_category": _risk_category(score).value,
        "delay_probability": round(delay_prob, 4),
        "predicted_delay_days": predicted_days,
    }


# ── Test Groups ───────────────────────────────────────────────────────────────

def test_model_load() -> dict:
    section("TEST 1 - Model Load & Metadata")
    from app.ml.model_store import load_model, get_latest_version

    try:
        version = get_latest_version()
        check("latest.txt pointer exists", True, f"version = {version}")
    except FileNotFoundError as e:
        check("latest.txt pointer exists", False, str(e))
        return {}

    try:
        bundle = load_model()
        check("classifier loaded", bundle["classifier"] is not None,
              type(bundle["classifier"]).__name__)
        check("feature columns present", len(bundle["feature_columns"]) > 0,
              f"{len(bundle['feature_columns'])} columns")
        check("categorical columns present", len(bundle["categorical_columns"]) > 0,
              str(bundle["categorical_columns"]))
        check("training timestamp exists", bool(bundle.get("training_timestamp")),
              bundle.get("training_timestamp", "MISSING"))

        has_reg = bundle["regressor"] is not None
        check("delay-duration regressor present", has_reg,
              type(bundle["regressor"]).__name__ if has_reg else "skipped (too few delayed samples)",
              warn=not has_reg)

        # Evaluation metrics
        ev = bundle.get("evaluation", {})
        clf_m = ev.get("classifier", {})
        cv    = clf_m.get("cross_validation", {})
        if cv and not cv.get("skipped"):
            auc = cv.get("oof_auc_roc", 0)
            f1  = cv.get("oof_f1", 0)
            check("cross-val AUC-ROC >= 0.60", auc >= 0.60, f"AUC = {auc}", warn=auc < 0.75)
            check("cross-val F1 >= 0.50",      f1  >= 0.50, f"F1  = {f1}",  warn=f1  < 0.65)
        else:
            check("cross-validation ran", False,
                  cv.get("reason", "No CV data in metadata"), warn=True)

        return bundle
    except Exception as e:
        check("model load", False, str(e))
        return {}


def test_prediction_sanity(bundle: dict):
    section("TEST 2 - Prediction Sanity (HIGH > LOW)")

    # Extreme high-risk
    high_row = make_row(
        compensation_disbursement_pct=5.0,
        open_legal_dispute_count=6,
        max_dispute_pendency_days=500,
        district_historical_delay_rate=0.90,
        agency_historical_delay_rate=0.85,
        rehabilitation_progress_pct=2.0,
        days_since_last_disbursement=400,
        stakeholder_update_count_90d=0,
        days_to_expected_completion=-100,     # already overdue
    )
    # Extreme low-risk
    low_row = make_row(
        compensation_disbursement_pct=98.0,
        open_legal_dispute_count=0,
        max_dispute_pendency_days=0,
        district_historical_delay_rate=0.05,
        agency_historical_delay_rate=0.05,
        rehabilitation_progress_pct=99.0,
        days_since_last_disbursement=3,
        stakeholder_update_count_90d=8,
        days_to_expected_completion=300,
        legal_dispute_count=0,
    )

    h = score_row(bundle, high_row)
    l = score_row(bundle, low_row)

    print(f"\n  HIGH-RISK scenario -> score={h['risk_score']} | category={h['risk_category']} | delay={h['predicted_delay_days']}d")
    print(f"  LOW-RISK  scenario -> score={l['risk_score']} | category={l['risk_category']} | delay={l['predicted_delay_days']}d")

    check("high-risk score > low-risk score",       h["risk_score"] > l["risk_score"],
          f"{h['risk_score']} > {l['risk_score']}")
    check("high-risk probability > 0.5",            h["delay_probability"] > 0.5,
          f"p={h['delay_probability']}")
    check("low-risk probability < 0.5",             l["delay_probability"] < 0.5,
          f"p={l['delay_probability']}")
    check("high category is HIGH or MEDIUM",
          h["risk_category"] in ("high", "medium"),
          h["risk_category"])
    check("low  category is LOW or MEDIUM",
          l["risk_category"] in ("low", "medium"),
          l["risk_category"])

    # Score gap should be meaningful
    gap = h["risk_score"] - l["risk_score"]
    check("score gap >= 20 points (discriminative power)", gap >= 20,
          f"gap = {round(gap, 1)} pts", warn=gap < 30)

    # Edge cases
    null_row = make_row(
        compensation_disbursement_pct=None,
        avg_days_between_updates=None,
        district_historical_delay_rate=None,
        agency_historical_delay_rate=None,
    )
    try:
        nr = score_row(bundle, null_row)
        check("handles None / NaN features gracefully", True,
              f"score={nr['risk_score']}")
    except Exception as e:
        check("handles None / NaN features gracefully", False, str(e))


def test_shap_explanations(bundle: dict):
    section("TEST 3 - SHAP Explanations & Driver Labels")
    import shap
    from app.ml.predict import _top_drivers, DRIVER_INFO

    classifier      = bundle["classifier"]
    feature_columns = bundle["feature_columns"]
    cat_cols        = bundle["categorical_columns"]

    row = make_row(
        compensation_disbursement_pct=15.0,
        open_legal_dispute_count=4,
        district_historical_delay_rate=0.75,
    )
    X = pd.DataFrame([row])
    for col in feature_columns:
        if col in cat_cols:
            X[col] = X[col].astype("category")
        else:
            X[col] = pd.to_numeric(X[col], errors="coerce")

    try:
        explainer   = shap.TreeExplainer(classifier)
        shap_values = explainer.shap_values(X)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        check("SHAP TreeExplainer succeeded", True,
              f"shap matrix shape: {shap_values.shape}")
    except Exception as e:
        check("SHAP TreeExplainer", False, str(e))
        return

    feature_values = row.copy()
    drivers = _top_drivers(shap_values[0], feature_columns, feature_values, top_n=3)

    check("top drivers returned (>=1)", len(drivers) >= 1, f"{len(drivers)} drivers")
    for i, d in enumerate(drivers):
        check(f"driver[{i}] has label",          bool(d.get("label")),          d.get("label", "MISSING"))
        check(f"driver[{i}] has recommendation", bool(d.get("recommendation")), d.get("recommendation", "MISSING")[:60])
        check(f"driver[{i}] has shap_impact",    d.get("shap_impact") is not None, str(d.get("shap_impact")))

    # Check recommendation is context-aware (contains actual numbers)
    has_numbers = any(
        any(ch.isdigit() for ch in d.get("recommendation", ""))
        for d in drivers
    )
    check("recommendations contain actual values (not generic)", has_numbers, warn=not has_numbers)


def test_multiple_project_types(bundle: dict):
    section("TEST 4 - Multiple Project Types & States")

    scenarios = [
        ("Highway/NHAI/UP",        make_row(project_type="highway",    implementing_agency="NHAI",                state="Uttar Pradesh")),
        ("Railway/DFCCIL/MH",      make_row(project_type="railway",    implementing_agency="DFCCIL",              state="Maharashtra")),
        ("Irrigation/StatePWD/RJ", make_row(project_type="irrigation", implementing_agency="State PWD",           state="Rajasthan")),
        ("Industrial/APIIC/TG",    make_row(project_type="industrial", implementing_agency="APIIC",               state="Telangana")),
        ("Urban/HMDA/KA",          make_row(project_type="urban",      implementing_agency="HMDA",                state="Karnataka")),
    ]

    for label, row in scenarios:
        try:
            r = score_row(bundle, row)
            check(f"{label} scores without error",
                  0 <= r["risk_score"] <= 100,
                  f"score={r['risk_score']} | cat={r['risk_category']}")
        except Exception as e:
            check(f"{label} scores without error", False, str(e))


def test_stage_risk(bundle: dict):
    section("TEST 5 - Stage-Specific Risk Scores")

    stages = ["notification", "survey", "approval", "compensation",
              "legal_resolution", "rehabilitation", "possession", "completed"]

    scores_by_stage = {}
    for stage in stages:
        row = make_row(current_stage=stage)
        try:
            r = score_row(bundle, row)
            scores_by_stage[stage] = r["risk_score"]
            check(f"stage '{stage}' scores OK", True,
                  f"score={r['risk_score']} | {r['risk_category']}")
        except Exception as e:
            check(f"stage '{stage}' scores OK", False, str(e))

    # Legal_resolution stage should generally be higher risk
    if "legal_resolution" in scores_by_stage and "completed" in scores_by_stage:
        check("legal_resolution risk > completed risk",
              scores_by_stage["legal_resolution"] >= scores_by_stage["completed"],
              f"{scores_by_stage['legal_resolution']} >= {scores_by_stage['completed']}",
              warn=scores_by_stage["legal_resolution"] < scores_by_stage["completed"])


def test_alert_logic():
    section("TEST 6 - Alert Generation Logic")
    from app.ml.alerts import _determine_severity, ALERT_TEMPLATES

    cases = [
        (90.0, "critical"),
        (85.0, "critical"),
        (75.0, "warning"),
        (60.0, "warning"),
        (45.0, "info"),
        (30.0, "info"),
    ]
    for score, expected in cases:
        got = _determine_severity(score)
        check(f"score={score} -> severity='{expected}'", got == expected,
              f"got '{got}'")

    # Verify templates are complete
    for sev, tmpl in ALERT_TEMPLATES.items():
        check(f"template '{sev}' has title",    bool(tmpl.get("title")),    sev)
        check(f"template '{sev}' has channels", bool(tmpl.get("channels")), str(tmpl.get("channels")))


def test_continuous_learning_logic():
    section("TEST 7 - Continuous Learning Trigger Logic")
    from app.ml.continuous_learning import (
        get_model_age_days, DRIFT_THRESHOLD, MIN_NEW_PROJECTS, MAX_MODEL_AGE_DAYS
    )

    age = get_model_age_days()
    check("model age computable", age < 9998, f"age = {age} days")
    check(f"MAX_MODEL_AGE_DAYS = {MAX_MODEL_AGE_DAYS}", MAX_MODEL_AGE_DAYS == 30,
          f"= {MAX_MODEL_AGE_DAYS}")
    check(f"MIN_NEW_PROJECTS = {MIN_NEW_PROJECTS}", MIN_NEW_PROJECTS == 5,
          f"= {MIN_NEW_PROJECTS}")
    check(f"DRIFT_THRESHOLD = {DRIFT_THRESHOLD}", DRIFT_THRESHOLD == 0.05,
          f"= {DRIFT_THRESHOLD}")


def test_model_versioning():
    section("TEST 8 - Model Versioning & Persistence")
    from app.ml.model_store import get_latest_version, get_model_metadata

    try:
        version = get_latest_version()
        meta = get_model_metadata(version)
        check("metadata.json readable",    True,  f"version = {version}")
        check("feature_columns in meta",   bool(meta.get("feature_columns")),  f"{len(meta.get('feature_columns', []))} cols")
        check("training_timestamp in meta",bool(meta.get("training_timestamp")),meta.get("training_timestamp","MISSING"))
        check("has_regressor flag present","has_regressor" in meta, str(meta.get("has_regressor")))
    except Exception as e:
        check("model versioning", False, str(e))


def test_api_endpoints(base_url: str):
    section(f"TEST 9 - Live API Endpoints ({base_url})")
    try:
        import requests
    except ImportError:
        check("requests library available", False, "pip install requests")
        return

    endpoints = [
        ("GET",  "/dashboard/summary",       None, 200),
        ("GET",  "/dashboard/trends",         None, 200),
        ("GET",  "/dashboard/gis-projects",   None, 200),
        ("GET",  "/alerts/summary",           None, 200),
        ("GET",  "/alerts/all",               None, 200),
        ("GET",  "/model/status",             None, 200),
        ("GET",  "/model/versions",           None, 200),
        ("GET",  "/stage-risks",              None, 200),
    ]
    for method, path, payload, expected_code in endpoints:
        url = base_url.rstrip("/") + path
        try:
            if method == "GET":
                resp = requests.get(url, timeout=10)
            else:
                resp = requests.post(url, json=payload, timeout=30)
            ok = resp.status_code == expected_code
            check(f"{method} {path}", ok,
                  f"HTTP {resp.status_code}" + (f" - {resp.text[:80]}" if not ok else ""))
        except Exception as e:
            check(f"{method} {path}", False, str(e))


def test_sample_csv_scoring(bundle: dict, csv_path: str = "sample_features.csv"):
    section("TEST 10 - Sample CSV Scoring (predict_new.py)")
    if not os.path.exists(csv_path):
        check(f"{csv_path} exists", False, "File not found - skipping")
        return

    df = pd.read_csv(csv_path)
    check("sample CSV readable", not df.empty, f"{len(df)} rows")

    feature_columns     = bundle["feature_columns"]
    categorical_columns = bundle["categorical_columns"]

    missing = [c for c in feature_columns if c not in df.columns]
    check("all feature columns present in CSV", not missing,
          f"missing: {missing}" if missing else f"all {len(feature_columns)} cols OK")

    if not missing:
        from app.ml.predict import _risk_category
        X = df[feature_columns].copy()
        for col in feature_columns:
            if col in categorical_columns:
                X[col] = X[col].astype("category")
            else:
                X[col] = pd.to_numeric(X[col], errors="coerce")

        probs = bundle["classifier"].predict_proba(X)[:, 1]
        scores = [round(float(p) * 100, 2) for p in probs]
        categories = [_risk_category(s).value for s in scores]

        print("\n  CSV Row Results:")
        for i, (score, cat) in enumerate(zip(scores, categories)):
            print(f"    Row {i+1}: risk_score={score:>6.2f}  category={cat}")
        check("all rows scored without error", len(scores) == len(df),
              f"{len(scores)}/{len(df)} rows")


# ── Final Summary ─────────────────────────────────────────────────────────────

def print_summary():
    section("SUMMARY")
    passed = sum(1 for r in results if r["status"] == "PASS")
    warned = sum(1 for r in results if r["status"] == "WARN")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    total  = len(results)
    print("")

    print(f"\n  Total : {total}")
    print(f"  {GREEN}PASS  : {passed}{RESET}")
    print(f"  {YELLOW}WARN  : {warned}{RESET}")
    print(f"  {RED}FAIL  : {failed}{RESET}")

    if failed == 0 and warned == 0:
        print(f"\n  {GREEN}{BOLD}[OK] ALL TESTS PASSED - Model is ready for frontend integration!{RESET}")
    elif failed == 0:
        print(f"\n  {YELLOW}{BOLD}[WARN] All tests passed with {warned} warning(s) - review before integration.{RESET}")
    else:
        print(f"\n  {RED}{BOLD}[FAIL] {failed} test(s) FAILED - fix before integrating with frontend.{RESET}")
        print(f"\n  Failed tests:")
        for r in results:
            if r["status"] == "FAIL":
                print(f"    • {r['test']}: {r['detail']}")

    print(f"\n  {INFO} To integrate with your backend, use:")
    print(f"       from app.ml.predict import score_all_projects")
    print(f"       from app.ml.train   import run_training")
    print(f"       from app.ml.alerts  import generate_alerts")
    print(f"       # Or call POST /model/predict via REST API\n")

    return failed == 0


# ── Entry Point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="LADRIS ML Model Verification Suite")
    parser.add_argument("--api-url", default=None,
                        help="Base URL for live API tests, e.g. http://localhost:8000")
    parser.add_argument("--quick", action="store_true",
                        help="Quick check: model load + prediction sanity only")
    parser.add_argument("--csv", default="sample_features.csv",
                        help="Path to CSV for scoring test (default: sample_features.csv)")
    args = parser.parse_args()

    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  LADRIS ML Model - Verification Suite{RESET}")
    print(f"{BOLD}  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{RESET}")
    print(f"{BOLD}{'='*60}{RESET}")

    bundle = test_model_load()
    if not bundle:
        print(f"\n{RED}Cannot continue - model failed to load. Run the pipeline first:{RESET}")
        print("  python scripts/run_ml_pipeline.py --n-synthetic 500")
        sys.exit(1)

    if args.quick:
        test_prediction_sanity(bundle)
        print_summary()
        return

    test_prediction_sanity(bundle)
    test_shap_explanations(bundle)
    test_multiple_project_types(bundle)
    test_stage_risk(bundle)
    test_alert_logic()
    test_continuous_learning_logic()
    test_model_versioning()
    test_sample_csv_scoring(bundle, args.csv)

    if args.api_url:
        test_api_endpoints(args.api_url)

    ok = print_summary()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
