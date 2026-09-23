"""
LADRIS — Alerts API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.misc import Alert, AlertStatus, AlertType, AlertSeverity
from app.models.project import Project
from app.models.ml_models import MLPrediction
from app.schemas.misc import AlertResponse, AlertUpdate, AlertSettingsSchema
from app.services.email_service import (
    get_alert_settings,
    save_alert_settings,
    trigger_alert_email_if_needed,
    format_alert_email,
    send_alert_email_async,
    resolve_officer_email,
)
from app.services.sms_service import trigger_alert_sms_if_needed

router = APIRouter(prefix="/alerts", tags=["Alerts"])

VALID_ALERT_REASONS = {
    "High Delay Risk",
    "Compensation Pending",
    "Legal Dispute",
    "R&R Delay",
    "Stage Overdue",
    "Risk Increased",
}

def classify_alert_reason(alert: Alert, project: Optional[Project] = None) -> tuple[str, str]:
    """
    Map an alert into one of the specific alert reasons:
    - High Delay Risk
    - Compensation Pending
    - Legal Dispute
    - R&R Delay
    - Stage Overdue
    - Risk Increased
    Returns (reason, short_explanation).
    """
    metadata = alert.alert_metadata or {}
    drivers = metadata.get("top_drivers") or []
    pname = (project.name if project else None) or metadata.get("project_name") or "Project"

    # 1. Existing valid reason title
    if alert.title in VALID_ALERT_REASONS:
        return alert.title, alert.message

    # 2. Check metadata top_drivers
    for d in drivers:
        feat = d.get("feature")
        direction = d.get("direction")
        rec = d.get("recommendation")
        if direction == "increases_risk":
            if feat == "compensation_disbursement_pct":
                return "Compensation Pending", rec or f"{pname}: Compensation disbursement is lagging behind schedule."
            if feat == "legal_dispute_count":
                return "Legal Dispute", rec or f"{pname}: Active legal disputes require mediation cell resolution."
            if feat == "rehabilitation_progress_pct":
                return "R&R Delay", rec or f"{pname}: Rehabilitation and resettlement progress is lagging."

    # 3. Check project attributes & alert types
    if alert.alert_type == AlertType.LEGAL_CASE_FILED or (project and (project.legal_case_count or 0) > 0):
        cases = project.legal_case_count if project else 1
        return "Legal Dispute", f"{pname} has {cases} active court dispute{'s' if cases > 1 else ''} pending."

    if alert.alert_type == AlertType.COMPENSATION_OVERDUE or (project and project.total_affected_families and (project.families_compensated or 0) < project.total_affected_families * 0.7):
        return "Compensation Pending", f"{pname}: Compensation disbursement pending for affected land parcels."

    if alert.alert_type == AlertType.RR_MILESTONE_MISSED or (project and (project.rehabilitation_progress_pct or 100) < 65):
        pct = project.rehabilitation_progress_pct if project and project.rehabilitation_progress_pct is not None else 0
        return "R&R Delay", f"{pname}: R&R progress ({pct:.0f}%) is behind statutory schedule."

    if alert.alert_type == AlertType.STAGE_DELAY or (project and (project.delay_months or 0) > 0):
        delay = project.delay_months if project and project.delay_months else 1
        return "Stage Overdue", f"{pname} is overdue on statutory stage milestones by {delay} month(s)."

    # 4. Check velocity / risk increase
    if metadata.get("velocity_status") in ("Rapidly Rising", "Rising") or (metadata.get("change_7d") and metadata.get("change_7d") > 5):
        change = round(metadata.get("change_7d", 0))
        return "Risk Increased", f"{pname}: Delay risk velocity accelerated by +{change} pts over last 7 days."

    # 5. Default High Delay Risk
    score = metadata.get("risk_score")
    score_str = f" ({score:.1f}/100)" if score is not None else ""
    return "High Delay Risk", f"{pname} has severe ML delay risk{score_str} requiring proactive intervention."

async def _seed_alerts_from_projects(db: AsyncSession):
    """Create one active alert per HIGH production prediction/model version."""
    projects = (await db.execute(select(Project).where(Project.deleted_at.is_(None)))).scalars().all()
    project_by_id = {project.id: project for project in projects}
    predictions = (await db.execute(
        select(MLPrediction).order_by(MLPrediction.project_id, desc(MLPrediction.predicted_at))
    )).scalars().all()
    latest = {}
    for prediction in predictions:
        latest.setdefault(prediction.project_id, prediction)

    existing = (await db.execute(select(Alert))).scalars().all()
    existing_keys = {
        (alert.project_id, str((alert.alert_metadata or {}).get("model_version")))
        for alert in existing
    }
    for project_id, prediction in latest.items():
        project = project_by_id.get(project_id)
        key = (project_id, prediction.model_version)
        if project is None or prediction.risk_category != "HIGH" or key in existing_keys:
            continue
        peak = max(
            prediction.stage_predictions or [],
            key=lambda item: float(item.get("risk_score", 0)),
            default={},
        )
        
        # Determine specific alert reason
        reason = "High Delay Risk"
        explanation = (
            f"{project.name} has severe delay risk ({prediction.risk_score:.1f}/100) "
            f"({prediction.delay_probability:.1%}) as of snapshot {prediction.snapshot_date}."
        )
        if (project.legal_case_count or 0) > 0:
            reason = "Legal Dispute"
            explanation = f"{project.name} has {project.legal_case_count} active court disputes creating significant delay risk."
        elif project.delay_months and project.delay_months > 0:
            reason = "Stage Overdue"
            dm = project.delay_months
            explanation = f"{project.name} is overdue on statutory milestones by {dm} {'month' if dm == 1 else 'months'}."
        elif (project.rehabilitation_progress_pct or 100) < 65:
            pct = project.rehabilitation_progress_pct if project.rehabilitation_progress_pct is not None else 0
            reason = "R&R Delay"
            explanation = f"{project.name}: Rehabilitation and resettlement progress ({pct:.0f}%) is behind schedule."
        elif project.total_affected_families and (project.families_compensated or 0) < project.total_affected_families * 0.7:
            reason = "Compensation Pending"
            explanation = f"{project.name}: Compensation disbursement is pending for affected land parcels."
        elif peak.get("risk_score", 0) >= 80 and peak.get("stage"):
            reason = "Stage Overdue"
            explanation = f"{project.name} has critical delay risk in the {peak.get('stage')} stage."

        new_alert = Alert(
            project_id=project.id,
            alert_type=AlertType.RISK_ESCALATION,
            severity=AlertSeverity.CRITICAL if prediction.risk_score >= 90 else AlertSeverity.HIGH,
            status=AlertStatus.ACTIVE,
            title=reason,
            message=explanation,
            alert_metadata={
                "prediction_source": "ml_predictions",
                "alert_reason": reason,
                "model_version": prediction.model_version,
                "prediction_id": str(prediction.id),
                "project_code": project.project_code,
                "project_name": project.name,
                "state_code": project.state_code,
                "risk_level": prediction.risk_category,
                "risk_score": prediction.risk_score,
                "delay_probability": prediction.delay_probability,
                "critical_stage": peak.get("stage"),
                "critical_stage_risk_score": peak.get("risk_score"),
            },
            triggered_at=prediction.predicted_at,
        )
        db.add(new_alert)
        await trigger_alert_email_if_needed(db, new_alert, project, current_risk_score=prediction.risk_score)
        await trigger_alert_sms_if_needed(db, new_alert, project, current_risk_score=prediction.risk_score)
    await db.commit()


@router.get("/settings", response_model=AlertSettingsSchema)
async def get_settings(
    current_user: User = Depends(get_current_user),
):
    """Retrieve current alert and email notification settings."""
    return get_alert_settings()


@router.post("/settings", response_model=AlertSettingsSchema)
async def update_settings(
    settings_data: AlertSettingsSchema,
    current_user: User = Depends(get_current_user),
):
    """Update alert and email notification settings."""
    if current_user.role not in [
        UserRole.SUPER_ADMIN,
        UserRole.STATE_ADMIN,
        UserRole.DISTRICT_OFFICER,
    ]:
        raise HTTPException(
            status_code=403, detail="Insufficient privileges to update alert settings"
        )
    saved = save_alert_settings(settings_data.model_dump())
    return saved


@router.post("/test-email")
async def send_test_email(
    target_email: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dispatch an immediate test email alert to verify SMTP delivery."""
    recipient = target_email or await resolve_officer_email(db)
    email_data = format_alert_email(
        project_name="[TEST] LADRIS System Connectivity Test",
        risk_level="HIGH",
        predicted_delay="60 days",
        main_issue="Immediate Alert Notification Pipeline Test",
        current_stage="Joint Measurement Survey",
        project_id=None,
    )
    result = await send_alert_email_async(
        to_email=recipient,
        subject=email_data["subject"],
        body_text=email_data["text"],
        body_html=email_data["html"],
    )
    return {
        "success": result.get("sent", False),
        "mode": result.get("mode"),
        "recipient": recipient,
        "error": result.get("error"),
        "timestamp": result.get("timestamp"),
    }


@router.get("", response_model=List[AlertResponse])
@router.get("/", response_model=List[AlertResponse])
async def get_alerts(
    project_id: Optional[uuid.UUID] = None,
    status: Optional[AlertStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (
        select(Alert)
        .outerjoin(Project, Alert.project_id == Project.id)
        .where(
            (Alert.project_id.is_(None)) | ((Project.id.isnot(None)) & (Project.deleted_at.is_(None)))
        )
        .options(joinedload(Alert.project))
        .order_by(desc(Alert.triggered_at))
    )
    
    if project_id:
        query = query.where(Alert.project_id == project_id)
    if status:
        query = query.where(Alert.status == status)
        
    result = await db.execute(query)
    alerts = result.scalars().all()
    
    # If no alerts exist yet, seed them once from ML predictions
    if not alerts and not project_id and not status:
        await _seed_alerts_from_projects(db)
        result = await db.execute(query)
        alerts = result.scalars().all()


    response_items = []
    for a in alerts:
        pname = a.project.name if a.project else (a.alert_metadata or {}).get("project_name")
        reason, explanation = classify_alert_reason(a, a.project)
        meta = a.alert_metadata or {}
        email_sent = bool(meta.get("email_sent", False))
        sent_at_val = meta.get("email_sent_at")
        email_sent_at = None
        if sent_at_val:
            try:
                email_sent_at = datetime.fromisoformat(sent_at_val.replace("Z", "+00:00"))
            except Exception:
                pass
        sms_sent = bool(meta.get("sms_sent", False))
        sms_sent_at_val = meta.get("sms_sent_at")
        sms_sent_at = None
        if sms_sent_at_val:
            try:
                sms_sent_at = datetime.fromisoformat(sms_sent_at_val.replace("Z", "+00:00"))
            except Exception:
                pass

        response_items.append(AlertResponse(
            id=a.id,
            project_id=a.project_id,
            project_name=pname,
            alert_reason=reason,
            explanation=explanation,
            alert_type=a.alert_type,
            severity=a.severity,
            status=a.status,
            title=reason if a.title.startswith("ML") or "ML HIGH-RISK" in a.title else a.title,
            message=explanation if a.message.startswith("ML") or "ML delay risk" in a.message else a.message,
            alert_metadata=a.alert_metadata or {},
            email_sent=email_sent,
            email_sent_at=email_sent_at,
            email_recipient=meta.get("email_recipient"),
            sms_sent=sms_sent,
            sms_sent_at=sms_sent_at,
            sms_recipient=meta.get("sms_recipient"),
            triggered_at=a.triggered_at,
            acknowledged_by=a.acknowledged_by,
            acknowledged_at=a.acknowledged_at,
            resolved_at=a.resolved_at,
            created_at=a.created_at,
        ))

    return response_items

@router.patch("/{alert_id}", response_model=AlertResponse)
async def update_alert(
    alert_id: uuid.UUID,
    update_data: AlertUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only officers/admins can update alerts
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.STATE_ADMIN, UserRole.DISTRICT_OFFICER, UserRole.PROJECT_OFFICER]:
        raise HTTPException(status_code=403, detail="Insufficient privileges")

    query = select(Alert).options(joinedload(Alert.project)).where(Alert.id == alert_id)
    result = await db.execute(query)
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    if update_data.status == AlertStatus.ACKNOWLEDGED and alert.status != AlertStatus.ACKNOWLEDGED:
        alert.acknowledged_at = datetime.now(timezone.utc)
        alert.acknowledged_by = current_user.id
        alert.status = update_data.status
    elif update_data.status == AlertStatus.RESOLVED and alert.status != AlertStatus.RESOLVED:
        alert.resolved_at = datetime.now(timezone.utc)
        alert.status = update_data.status
    else:
        alert.status = update_data.status

    await db.commit()
    await db.refresh(alert)
    
    pname = alert.project.name if alert.project else (alert.alert_metadata or {}).get("project_name")
    reason, explanation = classify_alert_reason(alert, alert.project)
    meta = alert.alert_metadata or {}
    email_sent = bool(meta.get("email_sent", False))
    sent_at_val = meta.get("email_sent_at")
    email_sent_at = None
    if sent_at_val:
        try:
            email_sent_at = datetime.fromisoformat(sent_at_val.replace("Z", "+00:00"))
        except Exception:
            pass
    sms_sent = bool(meta.get("sms_sent", False))
    sms_sent_at_val = meta.get("sms_sent_at")
    sms_sent_at = None
    if sms_sent_at_val:
        try:
            sms_sent_at = datetime.fromisoformat(sms_sent_at_val.replace("Z", "+00:00"))
        except Exception:
            pass

    return AlertResponse(
        id=alert.id,
        project_id=alert.project_id,
        project_name=pname,
        alert_reason=reason,
        explanation=explanation,
        alert_type=alert.alert_type,
        severity=alert.severity,
        status=alert.status,
        title=reason if alert.title.startswith("ML") or "ML HIGH-RISK" in alert.title else alert.title,
        message=explanation if alert.message.startswith("ML") or "ML delay risk" in alert.message else alert.message,
        alert_metadata=alert.alert_metadata or {},
        email_sent=email_sent,
        email_sent_at=email_sent_at,
        email_recipient=meta.get("email_recipient"),
        sms_sent=sms_sent,
        sms_sent_at=sms_sent_at,
        sms_recipient=meta.get("sms_recipient"),
        triggered_at=alert.triggered_at,
        acknowledged_by=alert.acknowledged_by,
        acknowledged_at=alert.acknowledged_at,
        resolved_at=alert.resolved_at,
        created_at=alert.created_at,
    )
