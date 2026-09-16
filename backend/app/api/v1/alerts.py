"""
LADRIS — Alerts API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc
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
from app.schemas.misc import AlertResponse, AlertUpdate

router = APIRouter(prefix="/alerts", tags=["Alerts"])

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
        db.add(Alert(
            project_id=project.id,
            alert_type=AlertType.RISK_ESCALATION,
            severity=AlertSeverity.CRITICAL if prediction.risk_score >= 90 else AlertSeverity.HIGH,
            status=AlertStatus.ACTIVE,
            title=f"ML high-risk project: {project.project_code}",
            message=(
                f"{project.name} has production-model delay risk {prediction.risk_score:.2f}/100 "
                f"({prediction.delay_probability:.1%}) at snapshot {prediction.snapshot_date}."
            ),
            alert_metadata={
                "prediction_source": "ml_predictions",
                "model_version": prediction.model_version,
                "prediction_id": str(prediction.id),
                "project_code": project.project_code,
                "state_code": project.state_code,
                "risk_level": prediction.risk_category,
                "risk_score": prediction.risk_score,
                "delay_probability": prediction.delay_probability,
                "critical_stage": peak.get("stage"),
                "critical_stage_risk_score": peak.get("risk_score"),
            },
            triggered_at=prediction.predicted_at,
        ))
    await db.commit()

@router.get("/", response_model=List[AlertResponse])
async def get_alerts(
    project_id: Optional[uuid.UUID] = None,
    status: Optional[AlertStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Alert).order_by(desc(Alert.triggered_at))
    
    if project_id:
        query = query.where(Alert.project_id == project_id)
    if status:
        query = query.where(Alert.status == status)
        
    result = await db.execute(query)
    alerts = result.scalars().all()
    
    # Synchronize production-model alerts without fabricating velocity history.
    if not project_id and not status:
        await _seed_alerts_from_projects(db)
        result = await db.execute(query)
        alerts = result.scalars().all()

    return alerts

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

    query = select(Alert).where(Alert.id == alert_id)
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
    return alert
