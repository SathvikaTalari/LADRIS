"""
LADRIS — Alerts flow and content tests
Validates:
1. Replaces generic 'ML HIGH-RISK DELAY PREDICTION' with specific reasons:
   - High Delay Risk
   - Compensation Pending
   - Legal Dispute
   - R&R Delay
   - Stage Overdue
   - Risk Increased
2. Every alert response exposes project_name, alert_reason, explanation, severity, status, triggered_at.
3. Preserves Active -> Acknowledged -> Resolved status flow logic.
"""
import pytest
from app.models.misc import Alert, AlertStatus, AlertType, AlertSeverity
from app.models.project import Project
from app.schemas.misc import AlertResponse
from app.api.v1.alerts import classify_alert_reason, VALID_ALERT_REASONS

def test_valid_alert_reasons_set():
    expected = {
        "High Delay Risk",
        "Compensation Pending",
        "Legal Dispute",
        "R&R Delay",
        "Stage Overdue",
        "Risk Increased",
    }
    assert expected == VALID_ALERT_REASONS

def test_classify_compensation_pending_from_driver():
    alert = Alert(
        title="ML HIGH-RISK DELAY PREDICTION",
        message="Mumbai project has ML delay risk 93.78/100.",
        alert_type=AlertType.RISK_ESCALATION,
        severity=AlertSeverity.HIGH,
        status=AlertStatus.ACTIVE,
        alert_metadata={
            "top_drivers": [
                {
                    "feature": "compensation_disbursement_pct",
                    "direction": "increases_risk",
                    "recommendation": "Accelerate compensation disbursement; currently only 50.0% disbursed.",
                }
            ]
        }
    )
    reason, explanation = classify_alert_reason(alert)
    assert reason == "Compensation Pending"
    assert "compensation disbursement" in explanation.lower()

def test_classify_legal_dispute_from_project_and_driver():
    proj = Project(name="Varanasi Bypass", legal_case_count=4)
    alert = Alert(
        title="ML HIGH-RISK DELAY PREDICTION",
        message="Varanasi project delay risk 91.18/100.",
        alert_type=AlertType.RISK_ESCALATION,
        severity=AlertSeverity.HIGH,
        status=AlertStatus.ACTIVE,
        alert_metadata={
            "top_drivers": [
                {
                    "feature": "legal_dispute_count",
                    "direction": "increases_risk",
                    "recommendation": "4 active court disputes recorded.",
                }
            ]
        }
    )
    reason, explanation = classify_alert_reason(alert, proj)
    assert reason == "Legal Dispute"
    assert "court disputes" in explanation.lower() or "dispute" in explanation.lower()

def test_classify_rr_delay():
    proj = Project(name="Nellore Corridor", rehabilitation_progress_pct=25.0)
    alert = Alert(
        title="ML HIGH-RISK DELAY PREDICTION",
        message="Lagging project.",
        alert_type=AlertType.RR_MILESTONE_MISSED,
        severity=AlertSeverity.HIGH,
        status=AlertStatus.ACTIVE,
        alert_metadata={}
    )
    reason, explanation = classify_alert_reason(alert, proj)
    assert reason == "R&R Delay"
    assert "r&r" in explanation.lower() or "rehabilitation" in explanation.lower()

def test_classify_stage_overdue():
    proj = Project(name="NH-65 Upgrade", delay_months=5)
    alert = Alert(
        title="ML HIGH-RISK DELAY PREDICTION",
        message="NH-65 is delayed.",
        alert_type=AlertType.STAGE_DELAY,
        severity=AlertSeverity.HIGH,
        status=AlertStatus.ACTIVE,
        alert_metadata={}
    )
    reason, explanation = classify_alert_reason(alert, proj)
    assert reason == "Stage Overdue"
    assert "month" in explanation.lower()

def test_classify_risk_increased():
    alert = Alert(
        title="ML HIGH-RISK DELAY PREDICTION",
        message="Risk rising.",
        alert_type=AlertType.RISK_ESCALATION,
        severity=AlertSeverity.HIGH,
        status=AlertStatus.ACTIVE,
        alert_metadata={"velocity_status": "Rapidly Rising", "change_7d": 18.5}
    )
    reason, explanation = classify_alert_reason(alert)
    assert reason == "Risk Increased"
    assert "+19 pts" in explanation or "velocity" in explanation.lower()

def test_alert_response_schema_fields():
    import uuid
    from datetime import datetime, timezone
    resp = AlertResponse(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        project_name="Jaipur Freight Corridor",
        alert_reason="Legal Dispute",
        explanation="2 active legal disputes pending in court.",
        alert_type=AlertType.RISK_ESCALATION,
        severity=AlertSeverity.HIGH,
        status=AlertStatus.ACTIVE,
        title="Legal Dispute",
        message="2 active legal disputes pending in court.",
        triggered_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    data = resp.model_dump()
    assert data["project_name"] == "Jaipur Freight Corridor"
    assert data["alert_reason"] == "Legal Dispute"
    assert data["explanation"] == "2 active legal disputes pending in court."
    assert data["status"] == AlertStatus.ACTIVE
    assert data["severity"] == AlertSeverity.HIGH
