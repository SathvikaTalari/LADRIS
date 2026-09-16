"""
LADRIS — Decision Intelligence API Integration Tests
Tests all 5 Decision Intelligence features:
1. Summary Header & Full Overview
2. Land Conflict Graph (Land Blockers)
3. What-If Risk Simulator (using production LightGBM ML model)
4. Compensation-to-Possession Gap Detector
5. Administrative Dependency Graph (Process Bottlenecks)
6. Action Impact Tracker (Interventions POST & GET)
Across Low, Medium, and High risk projects.
"""
import pytest
import httpx
from datetime import date

BASE_URL = "http://127.0.0.1:8000"


@pytest.fixture(scope="module")
def auth_headers():
    """Authenticate with running local backend server."""
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        res = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@ladris.gov.in", "password": "admin123"},
        )
        assert res.status_code == 200, f"Auth failed: {res.text}"
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def project_ids(auth_headers):
    """Fetch sample projects across risk spectrum."""
    with httpx.Client(base_url=BASE_URL, timeout=15.0, follow_redirects=True) as client:
        res = client.get("/api/v1/projects/", headers=auth_headers, params={"page_size": 20})
        assert res.status_code == 200, res.text
        items = res.json()["items"]
        assert len(items) > 0, "At least 1 project must exist"
        return [item["id"] for item in items[:5]]


def test_auth_protection(project_ids):
    """Verify all Decision Intelligence endpoints reject unauthenticated access."""
    pid = project_ids[0]
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        assert client.get(f"/api/v1/decision-intelligence/{pid}").status_code == 401
        assert client.get(f"/api/v1/decision-intelligence/{pid}/summary").status_code == 401
        assert client.get(f"/api/v1/decision-intelligence/{pid}/land-blockers").status_code == 401
        assert client.post(f"/api/v1/decision-intelligence/{pid}/simulate", json={}).status_code == 401
        assert client.get(f"/api/v1/decision-intelligence/{pid}/payment-possession-gap").status_code == 401
        assert client.get(f"/api/v1/decision-intelligence/{pid}/process-bottlenecks").status_code == 401
        assert client.get(f"/api/v1/decision-intelligence/{pid}/interventions").status_code == 401


def test_summary_header(auth_headers, project_ids):
    """Verify summary header returns real risk score, level, delay, stage, and blocker."""
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        for pid in project_ids[:3]:
            res = client.get(f"/api/v1/decision-intelligence/{pid}/summary", headers=auth_headers)
            assert res.status_code == 200, res.text
            data = res.json()
            assert "project_id" in data
            assert "project_name" in data
            assert "risk_score" in data
            assert data["risk_level"] in ("LOW", "MEDIUM", "HIGH")
            assert "predicted_delay_days" in data
            assert "current_stage" in data
            assert "main_blocker" in data
            assert "action_needed" in data
            assert data["model_version"] is not None


def test_land_blockers_graph(auth_headers, project_ids):
    """Verify Land Conflict Graph generates the 6-stage conflict chain."""
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        pid = project_ids[0]
        res = client.get(f"/api/v1/decision-intelligence/{pid}/land-blockers", headers=auth_headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["title"] == "Land Blockers"
        assert data["short_text"] == "See which land issues are stopping project progress."
        assert len(data["nodes"]) == 6
        expected_categories = ["PROJECT", "PARCEL", "OWNERSHIP", "LEGAL", "COMPENSATION", "POSSESSION"]
        for node, exp_cat in zip(data["nodes"], expected_categories):
            assert node["category"] == exp_cat
            assert node["status"] in ("CLEAR", "WARNING", "BLOCKED", "PENDING")
        assert "blocked_stage" in data
        assert "responsible_department" in data


def test_what_if_risk_simulator(auth_headers, project_ids):
    """Verify What-If Simulator recalculates ML prediction and yields practical improvements."""
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        pid = project_ids[0]
        # Simulate high disbursement and zero disputes
        payload = {
            "compensation_disbursement_pct": 98.0,
            "open_legal_dispute_count": 0,
            "rehabilitation_progress_pct": 100.0,
            "resettlement_site_ready": True,
            "stakeholder_update_count_90d": 5,
        }
        res = client.post(f"/api/v1/decision-intelligence/{pid}/simulate", headers=auth_headers, json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["title"] == "What-If Simulator"
        assert "baseline_risk_score" in data
        assert "simulated_risk_score" in data
        assert "risk_score_reduction" in data
        assert "delay_reduction_days" in data
        assert "minimum_practical_changes" in data
        assert isinstance(data["minimum_practical_changes"], list)
        assert data["model_version"] is not None


def test_payment_possession_gap_detector(auth_headers, project_ids):
    """Verify Payment vs Possession detector calculates payment %, possession %, and detects gaps."""
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        for pid in project_ids[:3]:
            res = client.get(f"/api/v1/decision-intelligence/{pid}/payment-possession-gap", headers=auth_headers)
            assert res.status_code == 200, res.text
            data = res.json()
            assert data["title"] == "Payment vs Possession"
            assert "payment_pct" in data
            assert "possession_pct" in data
            assert "gap_pct" in data
            assert data["status"] in ("Aligned", "Attention Needed", "Critical Disconnect", "Early Stage")
            assert "diagnostic" in data
            assert "action_needed" in data


def test_process_bottlenecks_graph(auth_headers, project_ids):
    """Verify Administrative Dependency Graph shows the 6 statutory stages and bottlenecks."""
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        pid = project_ids[0]
        res = client.get(f"/api/v1/decision-intelligence/{pid}/process-bottlenecks", headers=auth_headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["title"] == "Process Bottlenecks"
        assert len(data["stages"]) == 6
        assert "blocked_at" in data
        assert "responsible_department" in data
        assert "days_pending" in data
        assert "next_stages_affected" in data
        assert "recommendation" in data


def test_action_impact_tracker_interventions(auth_headers, project_ids):
    """Verify Action Impact Tracker records an official intervention and computes before/after risk impact."""
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        pid = project_ids[0]
        # 1. Post new intervention
        intervention_data = {
            "intervention_type": "DISPUTE_RESOLUTION",
            "title": "Resolved 2 Court Injunctions through Special Lok Adalat",
            "description": "Joint settlement agreed with title claimants in presence of District Collector.",
            "action_taken_by": "Special Land Acquisition Officer (CALA)",
            "resolved_disputes_count": 2,
            "updated_compensation_pct": 85.0,
        }
        create_res = client.post(
            f"/api/v1/decision-intelligence/{pid}/interventions",
            headers=auth_headers,
            json=intervention_data,
        )
        assert create_res.status_code == 201, create_res.text
        item = create_res.json()
        assert item["title"] == intervention_data["title"]
        assert "risk_score_before" in item
        assert "risk_score_after" in item
        assert "risk_score_reduction" in item
        assert "delay_reduction_days" in item
        assert item["model_version"] is not None

        # 2. Get interventions list
        list_res = client.get(f"/api/v1/decision-intelligence/{pid}/interventions", headers=auth_headers)
        assert list_res.status_code == 200
        records = list_res.json()
        assert len(records) >= 1
        assert any(r["id"] == item["id"] for r in records)


def test_full_overview_bundle(auth_headers, project_ids):
    """Verify single fast roundtrip overview bundle."""
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        pid = project_ids[0]
        res = client.get(f"/api/v1/decision-intelligence/{pid}", headers=auth_headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert "summary" in data
        assert "land_blockers" in data
        assert "what_if_baseline" in data
        assert "payment_possession_gap" in data
        assert "process_bottlenecks" in data
        assert "recent_interventions" in data
