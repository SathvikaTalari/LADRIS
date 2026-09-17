import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
from app.services.production_ml_service import _runtime

rt = _runtime()
bundle = rt.get_bundle()
cols = bundle["feature_columns"]
cats = bundle["categorical_columns"]

sample = {c: 0 for c in cols}
for c in cats:
    sample[c] = (
        "highway" if c == "project_type" else
        "NHAI" if c == "implementing_agency" else
        "Telangana" if c == "state" else
        "Sangareddy" if c == "district" else
        "possession"
    )

print("Varying compensation_disbursement_pct:")
for comp in [10, 25, 50, 75, 90, 100]:
    s = dict(sample)
    s["compensation_disbursement_pct"] = comp
    res = rt.predict_features(s)
    print(f"  Comp: {comp}% -> Risk: {res['risk_score']:.1f}, Delay: {res['predicted_delay_days']:.1f}, Prob: {res['delay_probability']:.2f}")

print("\nVarying open_legal_dispute_count:")
for d in [0, 1, 3, 5, 8]:
    s = dict(sample)
    s["open_legal_dispute_count"] = d
    res = rt.predict_features(s)
    print(f"  Disputes: {d} -> Risk: {res['risk_score']:.1f}, Delay: {res['predicted_delay_days']:.1f}, Prob: {res['delay_probability']:.2f}")

print("\nVarying rehabilitation_progress_pct:")
for r in [10, 30, 50, 70, 90, 100]:
    s = dict(sample)
    s["rehabilitation_progress_pct"] = r
    res = rt.predict_features(s)
    print(f"  Rehab: {r}% -> Risk: {res['risk_score']:.1f}, Delay: {res['predicted_delay_days']:.1f}, Prob: {res['delay_probability']:.2f}")
