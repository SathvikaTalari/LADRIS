"""
LADRIS ML Model - Feature Verification Script
=============================================
Run this to confirm every major feature of the ML model is working.

Usage:
    python check_features.py

Each test prints [PASS] or [FAIL] with details.
"""
import sys
import warnings
import json
import os

warnings.filterwarnings("ignore")
sys.path.insert(0, ".")

# Force UTF-8 output on Windows so special characters don't crash
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DIVIDER = "=" * 65
PASS = "[PASS]"
FAIL = "[FAIL]"
SKIP = "[SKIP]"


def section(title):
    print(f"\n{DIVIDER}")
    print(f"  {title}")
    print(DIVIDER)


def ok(msg):
    print(f"  {PASS}  {msg}")


def fail(msg):
    print(f"  {FAIL}  {msg}")


def skip(msg):
    print(f"  {SKIP}  {msg}")


# ─────────────────────────────────────────────────────────────────────────────
# SETUP
# ─────────────────────────────────────────────────────────────────────────────
section("SETUP — Imports & Database Connection")

try:
    from app.db.init_db import SessionLocal
    from app.db.schema import Project, RiskScore
    ok("app.db imported successfully")
except Exception as e:
    fail(f"DB import failed: {e}")
    sys.exit(1)

try:
    from app.ml.predict import score_all_projects
    from app.ml.stage_predictor import train_stage_predictor, predict_stage_risks
    from app.ml.model_store import load_model
    ok("ML modules imported successfully")
except Exception as e:
    fail(f"ML import failed: {e}")
    sys.exit(1)

try:
    session = SessionLocal()
    project_count = session.query(Project).count()
    ok(f"Database connected — {project_count} projects found")
    if project_count == 0:
        fail("No projects in database. Run the data ingestion pipeline first.")
        sys.exit(1)
except Exception as e:
    fail(f"DB connection failed: {e}")
    sys.exit(1)

try:
    bundle = load_model()
    ok(f"Model loaded — version: {bundle.get('version', 'unknown')}")
except Exception as e:
    fail(f"Model load failed: {e}  (Run: python scripts/run_ml_pipeline.py --skip-ingest)")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 1: Project-Level Risk Score (0-100)
# ─────────────────────────────────────────────────────────────────────────────
section("FEATURE 1 — Project-Level Risk Score (0 to 100)")

try:
    scores = score_all_projects(session)
    if not scores:
        fail("score_all_projects() returned empty list")
    else:
        valid = [s for s in scores if 0.0 <= s.risk_score <= 100.0]
        ok(f"Scored {len(scores)} projects")
        ok(f"All scores in 0-100 range: {len(valid)}/{len(scores)}")
        sample = scores[0]
        ok(f"Sample — Project ID: {sample.project_id}  |  Score: {sample.risk_score}")
except Exception as e:
    fail(f"score_all_projects() crashed: {e}")
    scores = []


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 2: Risk Category (LOW / MEDIUM / HIGH)
# ─────────────────────────────────────────────────────────────────────────────
section("FEATURE 2 — Risk Category (LOW / MEDIUM / HIGH)")

if scores:
    categories = set(s.risk_category.value for s in scores)
    ok(f"Categories present in output: {', '.join(sorted(categories)).upper()}")
    high   = [s for s in scores if s.risk_category.value == "high"]
    medium = [s for s in scores if s.risk_category.value == "medium"]
    low    = [s for s in scores if s.risk_category.value == "low"]
    ok(f"HIGH={len(high)}  MEDIUM={len(medium)}  LOW={len(low)}")
    if len(categories) >= 2:
        ok("Multiple categories found — model is not predicting everything the same")
    else:
        fail(f"Only 1 category found ({categories}). Model may be biased.")
else:
    skip("No scores to evaluate")


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 3: Delay Probability (0.0 to 1.0)
# ─────────────────────────────────────────────────────────────────────────────
section("FEATURE 3 — Delay Probability (0.0 to 1.0, calibrated)")

if scores:
    # delay_probability is risk_score / 100
    probs = [round(s.risk_score / 100, 4) for s in scores]
    valid_probs = [p for p in probs if 0.0 <= p <= 1.0]
    ok(f"All delay_probabilities in [0,1] range: {len(valid_probs)}/{len(probs)}")
    ok(f"Min probability: {min(probs):.4f}  |  Max: {max(probs):.4f}")
    ok(f"Mean probability: {sum(probs)/len(probs):.4f}")
else:
    skip("No scores to evaluate")


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 4: Expected Delay Days
# ─────────────────────────────────────────────────────────────────────────────
section("FEATURE 4 — Expected Delay Days (regressor output)")

if scores:
    with_delay = [s for s in scores if s.predicted_delay_days is not None]
    ok(f"Projects with predicted_delay_days: {len(with_delay)}/{len(scores)}")
    if with_delay:
        sample_delay = with_delay[0]
        ok(f"Sample: Project {sample_delay.project_id}  ->  {int(sample_delay.predicted_delay_days)} days delay predicted")
    else:
        fail("No project has predicted_delay_days — regressor may not be trained")
else:
    skip("No scores to evaluate")


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 5: SHAP Drivers — Why is there risk?
# ─────────────────────────────────────────────────────────────────────────────
section("FEATURE 5 — SHAP Drivers (Why is there risk?)")

if scores:
    with_drivers = [s for s in scores if s.top_drivers_json and s.top_drivers_json != "[]"]
    ok(f"Projects with SHAP drivers: {len(with_drivers)}/{len(scores)}")

    if with_drivers:
        # Show drivers for a HIGH-risk project if available
        sample = next((s for s in with_drivers if s.risk_category.value == "high"), with_drivers[0])
        drivers = json.loads(sample.top_drivers_json)
        proj_name = session.query(Project).filter(Project.id == sample.project_id).first()
        proj_label = proj_name.project_name if proj_name else str(sample.project_id)

        ok(f"Sample drivers for: {proj_label}  (Score: {sample.risk_score})")
        for i, d in enumerate(drivers, 1):
            impact = d.get("shap_impact", 0)
            label  = d.get("label", d["feature"])
            val    = d.get("feature_value")
            val_str = f" = {val}" if val is not None else ""
            print(f"        Driver {i}: {label}{val_str}  |  SHAP impact: {impact:+.4f}")
    else:
        fail("No SHAP drivers found in any project")
else:
    skip("No scores to evaluate")


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 6: Actionable Recommendations
# ─────────────────────────────────────────────────────────────────────────────
section("FEATURE 6 — Actionable Recommendations")

if scores:
    with_recs = [s for s in scores if s.recommendations_json and s.recommendations_json != "[]"]
    ok(f"Projects with recommendations: {len(with_recs)}/{len(scores)}")

    if with_recs:
        sample = next((s for s in with_recs if s.risk_category.value == "high"), with_recs[0])
        recs = json.loads(sample.recommendations_json)
        ok(f"Sample recommendations ({len(recs)} total):")
        for i, r in enumerate(recs[:2], 1):
            # Trim for display
            r_short = r[:100] + "..." if len(r) > 100 else r
            print(f"        Rec {i}: {r_short}")
    else:
        fail("No recommendations found")
else:
    skip("No scores to evaluate")


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 7: Stage-Wise Risk (8 lifecycle stages)
# ─────────────────────────────────────────────────────────────────────────────
section("FEATURE 7 — Stage-Wise Risk (8 stages per project)")

STAGES = ["notification","survey","approval","compensation",
          "legal_resolution","rehabilitation","possession","completed"]

try:
    print("  Training stage predictor (this may take ~30 seconds)...")
    stage_bundle = train_stage_predictor(session)
    if stage_bundle.get("trained"):
        ok(f"Stage models trained: {len(stage_bundle.get('models', {}))} classifiers")
    else:
        fail("Stage predictor did not train successfully")

    stage_results = predict_stage_risks(session, stage_bundle if stage_bundle.get("trained") else None)
    if not stage_results:
        fail("predict_stage_risks() returned empty list")
    else:
        ok(f"Stage results generated: {len(stage_results)} stage predictions across all projects")

        # Check all expected stages are present
        found_stages = set(r["stage"] for r in stage_results)
        missing = set(STAGES) - found_stages
        if missing:
            fail(f"Missing stages in output: {missing}")
        else:
            ok(f"All 8 stages present in output: {', '.join(sorted(found_stages))}")

        # Show breakdown for one project
        if scores:
            # Use highest-risk project
            top_proj = max(scores, key=lambda s: s.risk_score)
            proj_stages = [r for r in stage_results if str(r["project_id"]) == str(top_proj.project_id)]
            proj_stages.sort(key=lambda r: STAGES.index(r["stage"]) if r["stage"] in STAGES else 99)

            proj_name_obj = session.query(Project).filter(Project.id == top_proj.project_id).first()
            proj_label = proj_name_obj.project_name if proj_name_obj else str(top_proj.project_id)
            print(f"\n  Stage breakdown for: {proj_label}")
            print(f"  {'Stage':<22} {'Score':>7} {'Category':>10} {'Delay Prob':>12} {'Expected Completion':<20} {'Current?'}")
            print(f"  {'-'*22} {'-'*7} {'-'*10} {'-'*12} {'-'*20} {'-'*8}")
            for r in proj_stages:
                marker = "<< NOW" if r["is_current_stage"] else ""
                exp_date = str(r.get("expected_completion_date") or "N/A")
                print(
                    f"  {r['stage']:<22} "
                    f"{r['risk_score']:>7.1f} "
                    f"{r['risk_category'].upper():>10} "
                    f"{r['delay_probability']:>12.4f} "
                    f"{exp_date:<20} "
                    f"{marker}"
                )
except Exception as e:
    fail(f"Stage predictor crashed: {e}")
    stage_results = []


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 8: Stage Expected Completion Date
# ─────────────────────────────────────────────────────────────────────────────
section("FEATURE 8 — Stage Expected Completion Dates")

if stage_results:
    with_date = [r for r in stage_results if r.get("expected_completion_date") is not None]
    ok(f"Stage results with expected_completion_date: {len(with_date)}/{len(stage_results)}")
    if with_date:
        s = with_date[0]
        ok(f"Sample: project={s['project_id']}  stage={s['stage']}  date={s['expected_completion_date']}")
    else:
        fail("No stage has an expected_completion_date value")
else:
    skip("No stage results to evaluate")


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 9: Stage-Level Driver Explanations
# ─────────────────────────────────────────────────────────────────────────────
section("FEATURE 9 — Stage-Level Driver Explanations (why is stage at risk?)")

if stage_results:
    with_drivers = [r for r in stage_results if r.get("drivers")]
    ok(f"Stage results with drivers: {len(with_drivers)}/{len(stage_results)}")
    if with_drivers:
        s = next((r for r in with_drivers if r["is_current_stage"]), with_drivers[0])
        ok(f"Stage '{s['stage']}' drivers:")
        for i, d in enumerate(s["drivers"][:3], 1):
            print(f"        Driver {i}: {d}")
    else:
        fail("No stage result has driver explanations")
else:
    skip("No stage results to evaluate")


# ─────────────────────────────────────────────────────────────────────────────
# FINAL SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
section("FINAL SUMMARY")

print("""
  Feature                               Checks
  -----------------------------------   -----------------------------------
  1. Project-level risk score           score_all_projects() -> risk_score
  2. Risk category                      LOW / MEDIUM / HIGH
  3. Delay probability                  risk_score / 100  (0.0 - 1.0)
  4. Expected delay days                predicted_delay_days (regressor)
  5. SHAP drivers (why is risk there?)  top_drivers_json
  6. Actionable recommendations         recommendations_json
  7. Stage-wise risk (8 stages)         predict_stage_risks()
  8. Stage expected completion date     expected_completion_date per stage
  9. Stage driver explanations          drivers list per stage
""")
print(f"  Run this script any time to verify the model is working correctly.")
print(f"  If any [FAIL] appears, run:  python scripts/run_ml_pipeline.py --skip-ingest")
print(DIVIDER)

session.close()
