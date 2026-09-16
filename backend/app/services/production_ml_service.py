"""Application service for persisted, point-in-time production predictions."""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import date, datetime, timezone, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.ml_models import MLPrediction, MLModelRegistry, MLModelType
from app.models.project import Project, RiskLevel
from app.models.misc import Alert, AlertSeverity, AlertStatus, AlertType
from app.services.ml_feature_service import build_features, load_project_context, validate_project_consistency

log = logging.getLogger(__name__)


STATUTORY_STAGE_DURATIONS = {
    "notification": 30,
    "survey": 60,
    "approval": 90,
    "compensation": 120,
    "legal_resolution": 180,
    "rehabilitation": 120,
    "possession": 30,
    "completed": 0,
}

STAGE_DISPLAY_NAMES = {
    "notification": "Section 3A / 11 Preliminary Notification",
    "survey": "Social Impact Assessment & Survey",
    "approval": "Section 19 / Declaration & Approvals",
    "compensation": "Award Inquiry & Compensation Disbursement",
    "legal_resolution": "Section 21 Objections & Dispute Resolution",
    "rehabilitation": "R&R Resettlement & Rehabilitation",
    "possession": "Physical Possession & Demarcation",
    "completed": "Project Handover & Completion",
}


def _runtime():
    settings = get_settings()
    models_dir = settings.resolved_models_dir
    ml_path = settings.resolved_ml_module_path
    os.environ["MODELS_DIR"] = models_dir
    if ml_path not in sys.path:
        sys.path.insert(0, ml_path)
    from ml import model_store
    model_store.MODELS_DIR = models_dir
    from ml import inference
    return inference


def warm_production_model() -> dict[str, Any]:
    return _runtime().warm_model()


async def sync_model_registry(db: AsyncSession) -> None:
    """Mirror the active artifact metadata into PostgreSQL idempotently."""
    info = _runtime().model_info()
    version = info["model_version"]
    existing = (await db.execute(
        select(MLModelRegistry).where(MLModelRegistry.model_version == version)
    )).scalar_one_or_none()
    await db.execute(
        MLModelRegistry.__table__.update().values(is_current=False)
    )
    if existing is None:
        models_dir = get_settings().resolved_models_dir
        existing = MLModelRegistry(
            model_name="LADRIS production delay-risk bundle",
            model_version=version,
            model_type=MLModelType.BINARY_CLASSIFIER,
            dataset_version=info.get("data_hash") or "synthetic_projects.csv",
            record_count_used=(info.get("evaluation") or {}).get("n_labeled"),
            feature_list=info["feature_columns"],
            evaluation_metrics=info.get("evaluation") or {},
            model_path=os.path.join(models_dir, version),
            preprocessing_path=os.path.join(models_dir, version, "classifier.joblib"),
            authenticity_statement="Existing calibrated LightGBM production bundle; not trained by request handlers.",
            data_sources_used=["synthetic_projects.csv"],
        )
        db.add(existing)
    existing.is_current = True


async def sync_prediction_alert(db: AsyncSession, project, result: dict[str, Any]) -> None:
    """Create or resolve the active alert sourced from the latest ML result."""
    title = "ML HIGH-RISK DELAY PREDICTION"
    active = (await db.execute(select(Alert).where(
        Alert.project_id == project.id,
        Alert.alert_type == AlertType.RISK_ESCALATION,
        Alert.title == title,
        Alert.status.in_([AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED]),
    ))).scalar_one_or_none()
    if result["risk_category"] == "HIGH":
        metadata = {
            "source": "production_ml_prediction",
            "model_version": result["model_version"],
            "risk_score": result["risk_score"],
            "delay_probability": result["delay_probability"],
            "predicted_delay_days": result["predicted_delay_days"],
            "top_drivers": result["top_drivers"],
        }
        if active is None:
            db.add(Alert(
                project_id=project.id, alert_type=AlertType.RISK_ESCALATION,
                severity=AlertSeverity.HIGH, status=AlertStatus.ACTIVE, title=title,
                message=f"{project.name} has ML delay risk {result['risk_score']:.2f}/100.",
                alert_metadata=metadata,
            ))
        else:
            active.message = f"{project.name} has ML delay risk {result['risk_score']:.2f}/100."
            active.alert_metadata = metadata
            active.triggered_at = datetime.now(timezone.utc)
    elif active is not None:
        active.status = AlertStatus.RESOLVED
        active.resolved_at = datetime.now(timezone.utc)


def serialize_prediction(
    row: MLPrediction,
    unavailable_features: list[str] | None = None,
    previous_score: float | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    predicted_at = row.predicted_at
    if predicted_at and predicted_at.tzinfo is None:
        predicted_at = predicted_at.replace(tzinfo=timezone.utc)
    stale = bool(predicted_at and (now - predicted_at).total_seconds() > get_settings().ML_PREDICTION_STALE_HOURS * 3600)

    p10 = (row.prediction_interval or {}).get("p10")
    p90 = (row.prediction_interval or {}).get("p90")
    delay_range = {
        "lower_days": p10,
        "upper_days": p90,
        "range_text": f"{int(p10 or 0)} – {int(p90 or 0)} days",
    }

    # Compute stage completion estimates and critical bottleneck stage
    stage_completion_estimates = []
    critical_stage = None
    max_stage_risk = -1.0

    base_date = row.snapshot_date.date() if hasattr(row.snapshot_date, "date") else row.snapshot_date
    if isinstance(base_date, datetime):
        base_date = base_date.date()
    cumulative_days = 0

    for sp in (row.stage_predictions or []):
        st_name = sp.get("stage", "")
        st_risk = float(sp.get("risk_score") or 0.0)
        st_prob = float(sp.get("delay_probability") or 0.0)
        base_days = STATUTORY_STAGE_DURATIONS.get(st_name, 60)
        multiplier = 1.0 + (st_risk / 100.0) * 1.5
        est_duration = int(round(base_days * multiplier)) if base_days > 0 else 0
        cumulative_days += est_duration
        est_date = (base_date + timedelta(days=cumulative_days)).isoformat() if est_duration > 0 else base_date.isoformat()

        stage_completion_estimates.append({
            "stage": st_name,
            "stage_name_display": STAGE_DISPLAY_NAMES.get(st_name, st_name.replace("_", " ").title()),
            "baseline_days": base_days,
            "estimated_duration_days": est_duration,
            "delay_probability": st_prob,
            "risk_score": st_risk,
            "risk_category": sp.get("risk_category", "LOW"),
            "expected_completion_date": est_date,
        })

        if st_name != "completed" and st_risk > max_stage_risk:
            max_stage_risk = st_risk
            critical_stage = {
                "stage": st_name,
                "stage_name_display": STAGE_DISPLAY_NAMES.get(st_name, st_name.replace("_", " ").title()),
                "risk_score": st_risk,
                "delay_probability": st_prob,
                "reason": f"Predicted critical bottleneck stage with {st_risk:.1f}/100 delay risk score and {st_prob*100:.1f}% delay probability.",
            }

    # Calculate Risk Trend
    if previous_score is not None:
        delta = round(float(row.risk_score) - float(previous_score), 1)
        if delta > 1.5:
            trend = "INCREASING"
        elif delta < -1.5:
            trend = "DECREASING"
        else:
            trend = "STABLE"
    else:
        delta = 0.0
        trend = "STABLE"

    risk_trend = {
        "trend": trend,
        "delta": delta,
        "previous_score": previous_score,
    }

    # Recommended Action
    top_drivers = row.top_drivers or []
    recommended_action = None
    if row.recommendations and len(row.recommendations) > 0:
        recommended_action = row.recommendations[0]
    elif top_drivers and len(top_drivers) > 0:
        top_drv = top_drivers[0]
        recommended_action = top_drv.get("recommendation") or f"Address {top_drv.get('feature', 'key factor').replace('_', ' ')} to mitigate delay risk."
    if not recommended_action:
        recommended_action = "Maintain regular stakeholder reviews and accelerate statutory milestone compliance."

    # High-Risk Alert
    is_high_risk = row.risk_category == "HIGH" or row.risk_score >= 70.0
    high_risk_alert = {
        "requires_immediate_attention": is_high_risk,
        "alert_level": "HIGH" if is_high_risk else ("MEDIUM" if row.risk_category == "MEDIUM" else "LOW"),
        "alert_message": (
            f"HIGH RISK ALERT: Project requires immediate intervention. Predicted delay probability {row.delay_probability*100:.1f}% with estimated delay of {int(row.predicted_delay_days or 0)} days."
            if is_high_risk
            else "Project delay risk is within acceptable statutory parameters."
        ),
    }

    return {
        "prediction_status": "AVAILABLE",
        "prediction_id": str(row.id),
        "project_id": str(row.project_id),
        "snapshot_date": row.snapshot_date.isoformat(),
        "predicted_at": row.predicted_at.isoformat(),
        "model_version": row.model_version,
        # 12 Core ML outputs
        "delay_probability": row.delay_probability,
        "risk_score": row.risk_score,
        "risk_category": row.risk_category,
        "estimated_delay_days": row.predicted_delay_days,
        "predicted_delay_days": row.predicted_delay_days,  # legacy alias
        "delay_range": delay_range,
        "prediction_interval": row.prediction_interval,
        "stage_wise_risk": row.stage_predictions or [],
        "stage_predictions": row.stage_predictions or [],  # legacy alias
        "stage_completion_estimates": stage_completion_estimates,
        "critical_stage": critical_stage or {
            "stage": (row.feature_snapshot or {}).get("current_stage") or "notification",
            "stage_name_display": STAGE_DISPLAY_NAMES.get((row.feature_snapshot or {}).get("current_stage") or "notification", "Land Acquisition"),
            "risk_score": row.risk_score,
            "delay_probability": row.delay_probability,
            "reason": "Active operational stage.",
        },
        "top_delay_drivers": top_drivers,
        "top_drivers": top_drivers,  # legacy alias
        "risk_trend": risk_trend,
        "recommended_action": recommended_action,
        "recommendations": row.recommendations or [recommended_action],
        "high_risk_alert": high_risk_alert,
        # Metadata and lineage
        "validation": row.validation,
        "latency_ms": row.latency_ms,
        "current_stage": (row.feature_snapshot or {}).get("current_stage"),
        "data_completeness_pct": round(sum(value is not None for value in (row.feature_snapshot or {}).values()) / 23 * 100, 1),
        "is_stale": stale,
        "unavailable_features": unavailable_features or [],
    }


async def generate_prediction(db: AsyncSession, project_id, snapshot_date: datetime | None = None) -> dict[str, Any]:
    snapshot_date = snapshot_date or datetime.now(timezone.utc)
    if snapshot_date.tzinfo is None:
        snapshot_date = snapshot_date.replace(tzinfo=timezone.utc)
    if snapshot_date > datetime.now(timezone.utc):
        raise ValueError("snapshot_date cannot be in the future")
    project, population = await load_project_context(db, project_id)
    if project is None:
        raise LookupError("Project not found")

    # Log consistency warnings without blocking predictions
    consistency_errors = validate_project_consistency(project)
    if consistency_errors:
        log.warning("Project %s consistency warnings: %s", project.id, consistency_errors)

    prev_pred = None
    if hasattr(db, "execute"):
        prev_pred = await previous_prediction(db, project.id)
    prev_score = prev_pred.risk_score if prev_pred else None

    features, unavailable = build_features(project, population, snapshot_date)
    if consistency_errors:
        unavailable.extend([f"consistency_warning: {e}" for e in consistency_errors])

    runtime = _runtime()
    result = await asyncio.to_thread(runtime.predict_features, features)
    stages = await asyncio.to_thread(runtime.predict_stages, features)

    project.risk_level = RiskLevel(result["risk_category"])
    row = MLPrediction(
        project_id=project.id, snapshot_date=snapshot_date, model_version=result["model_version"],
        feature_snapshot=features, delay_probability=result["delay_probability"], risk_score=result["risk_score"],
        risk_category=result["risk_category"], predicted_delay_days=result["predicted_delay_days"],
        prediction_interval=result["prediction_interval"], stage_predictions=stages,
        top_drivers=result["top_drivers"], recommendations=result["recommendations"],
        validation=result["validation"], latency_ms=result["latency_ms"],
    )
    db.add(row)
    await db.flush()
    await sync_prediction_alert(db, project, result)
    await db.refresh(row)
    log.info("ML prediction project=%s model=%s latency_ms=%s", project_id, row.model_version, row.latency_ms)
    return serialize_prediction(row, unavailable, previous_score=prev_score)


async def ensure_current_prediction(db: AsyncSession, project_id) -> dict[str, Any]:
    """Generate only when model version or the day-level feature snapshot changed."""
    now = datetime.now(timezone.utc)
    project, population = await load_project_context(db, project_id)
    if project is None:
        raise LookupError("Project not found")
    features, unavailable = build_features(project, population, now)
    existing = await latest_prediction(db, project_id)
    version = _runtime().model_info()["model_version"]
    if existing is not None and existing.model_version == version and existing.feature_snapshot == features:
        prev_pred = None
        if hasattr(db, "execute"):
            prev_pred = (await db.execute(
                select(MLPrediction)
                .where(MLPrediction.project_id == project_id, MLPrediction.id != existing.id)
                .order_by(MLPrediction.predicted_at.desc())
                .limit(1)
            )).scalar_one_or_none()
        prev_score = prev_pred.risk_score if prev_pred else None
        return serialize_prediction(existing, unavailable, previous_score=prev_score)
    return await generate_prediction(db, project_id, now)


async def previous_prediction(db: AsyncSession, project_id) -> MLPrediction | None:
    if not hasattr(db, "execute"):
        return None
    result = await db.execute(
        select(MLPrediction)
        .where(MLPrediction.project_id == project_id)
        .order_by(MLPrediction.predicted_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def latest_prediction(db: AsyncSession, project_id) -> MLPrediction | None:
    if not hasattr(db, "execute"):
        return None
    result = await db.execute(
        select(MLPrediction)
        .where(MLPrediction.project_id == project_id)
        .order_by(MLPrediction.predicted_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def latest_predictions(db: AsyncSession) -> list[MLPrediction]:
    rows = (await db.execute(
        select(MLPrediction)
        .join(Project, Project.id == MLPrediction.project_id)
        .where(Project.deleted_at.is_(None))
        .order_by(MLPrediction.project_id, MLPrediction.predicted_at.desc())
    )).scalars().all()
    found = {}
    for row in rows:
        found.setdefault(row.project_id, row)
    return list(found.values())
