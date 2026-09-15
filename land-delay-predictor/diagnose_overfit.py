"""Diagnose why model predicts everything as HIGH risk."""
import sys, os, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
import numpy as np
from app.ml.model_store import load_model

bundle = load_model()
clf    = bundle["classifier"]
feature_columns = bundle["feature_columns"]
cat_cols        = bundle["categorical_columns"]

# ── 1. Raw probabilities on sample CSV ───────────────────────────────────────
df = pd.read_csv("sample_features.csv")
X  = df[feature_columns].copy()
for col in feature_columns:
    if col in cat_cols:
        X[col] = X[col].astype("category")
    else:
        X[col] = pd.to_numeric(X[col], errors="coerce")

probs = clf.predict_proba(X)
print("RAW PROBABILITIES  (P_not_delayed | P_delayed):")
for i, p in enumerate(probs):
    row_data = df.iloc[i]
    comp = row_data.get("compensation_disbursement_pct", "?")
    disputes = row_data.get("open_legal_dispute_count", "?")
    print(f"  Row {i+1}:  P_not_delayed={p[0]:.6f}  P_delayed={p[1]:.6f}"
          f"  [comp={comp}% | open_disputes={disputes}]")

# ── 2. Extreme synthetic test ─────────────────────────────────────────────────
print()
print("EXTREME SANITY CHECK:")
best_row = {
    "project_type": "highway", "state": "Telangana", "district": "Hyderabad",
    "implementing_agency": "NHAI",
    "land_area_hectares": 10.0, "affected_families_count": 5,
    "days_since_notification": 10, "days_to_expected_completion": 500,
    "compensation_sanctioned": 1_000_000, "compensation_disbursed": 999_000,
    "compensation_disbursement_pct": 99.9,
    "days_since_last_disbursement": 1,
    "legal_dispute_count": 0, "open_legal_dispute_count": 0,
    "max_dispute_pendency_days": 0,
    "rehabilitation_progress_pct": 100.0,
    "resettlement_site_ready": 1,
    "stakeholder_update_count_90d": 10, "avg_days_between_updates": 5.0,
    "stage_count_recorded": 1,
    "current_stage": "notification",
    "district_historical_delay_rate": 0.01,
    "agency_historical_delay_rate": 0.01,
}
X_best = pd.DataFrame([best_row])
for col in feature_columns:
    if col in cat_cols:
        X_best[col] = X_best[col].astype("category")
    else:
        X_best[col] = pd.to_numeric(X_best[col], errors="coerce")
p_best = clf.predict_proba(X_best)[0]
print(f"  PERFECT project:  P_not_delayed={p_best[0]:.6f}  P_delayed={p_best[1]:.6f}")

# ── 3. Classifier parameters ──────────────────────────────────────────────────
print()
print("CLASSIFIER PARAMS:")
params = clf.get_params()
for k in ["n_estimators","num_leaves","max_depth","min_child_samples",
          "reg_alpha","reg_lambda","subsample","colsample_bytree","learning_rate"]:
    print(f"  {k} = {params.get(k)}")

# ── 4. Feature importances ────────────────────────────────────────────────────
print()
print("TOP FEATURE IMPORTANCES (by split count):")
imps = sorted(zip(feature_columns, clf.feature_importances_), key=lambda x: -x[1])
for f, v in imps[:10]:
    print(f"  {f:45s}: {v}")

# ── 5. Training metadata ──────────────────────────────────────────────────────
print()
print("TRAINING METADATA:")
ev = bundle.get("evaluation", {})
cm = ev.get("classifier", ev)
print(f"  test_auc        = {cm.get('test_auc')}")
print(f"  delay_rate      = {cm.get('delay_rate')}")
print(f"  scale_pos_weight= {cm.get('scale_pos_weight')}")
print(f"  n_train         = {cm.get('n_train')}")
print(f"  n_test          = {cm.get('n_test')}")
cv = cm.get("cross_validation", {})
print(f"  cv_auc_roc      = {cv.get('oof_auc_roc')}")
print(f"  cv_f1           = {cv.get('oof_f1')}")

print()
print("DIAGNOSIS:")
p_delayed_all = probs[:, 1]
if p_delayed_all.min() > 0.95:
    print("  [OVERFIT] Model outputs >0.95 delay probability for ALL rows.")
    print("  Root cause: Model overfit to synthetic data — outputs saturated logits.")
    print("  Fix: Stronger regularization + probability calibration needed.")
