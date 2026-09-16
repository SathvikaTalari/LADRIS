"""Application service for persisted, point-in-time production predictions."""
from __future__ import annotations

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.ml_models import MLPrediction, MLModelRegistry, MLModelType
from app.models.project import Project, RiskLevel
from app.models.misc import Alert, AlertSeverity, AlertStatus, AlertType
from app.services.ml_feature_service import build_features, load_project_context, validate_project_consistency

log = logging.getLogger(__name__)


def _runtime():
    settings = get_settings()
    os.environ["MODELS_DIR"] = settings.MODELS_DIR
    if settings.ML_MODULE_PATH not in sys.path:
        sys.path.insert(0, settings.ML_MODULE_PATH)
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
        existing = MLModelRegistry(
            model_name="LADRIS production delay-risk bundle",
            model_version=version,
            model_type=MLModelType.BINARY_CLASSIFIER,
            dataset_version=info.get("data_hash") or "synthetic_projects.csv",
            record_count_used=(info.get("evaluation") or {}).get("n_labeled"),
            feature_list=info["feature_columns"],
            evaluation_metrics=info.get("evaluation") or {},
            model_path=os.path.join(get_settings().MODELS_DIR, version),
            preprocessing_path=os.path.join(get_settings().MODELS_DIR, version, "classifier.joblib"),
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


def serialize_prediction(row: MLPrediction, unavailable_features: list[str] | None = None) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    predicted_at = row.predicted_at
    if predicted_at and predicted_at.tzinfo is None:
        predicted_at = predicted_at.replace(tzinfo=timezone.utc)
    stale = bool(predicted_at and (now - predicted_at).total_seconds() > get_settings().ML_PREDICTION_STALE_HOURS * 3600)
    return {
        "prediction_status": "AVAILABLE",
        "prediction_id": str(row.id), "project_id": str(row.project_id),
        "snapshot_date": row.snapshot_date.isoformat(), "predicted_at": row.predicted_at.isoformat(),
        "model_version": row.model_version, "delay_probability": row.delay_probability,
        "risk_score": row.risk_score, "risk_category": row.risk_category,
        "predicted_delay_days": row.predicted_delay_days,
        "prediction_interval": row.prediction_interval, "stage_predictions": row.stage_predictions,
        "top_drivers": row.top_drivers, "recommendations": row.recommendations,
        "validation": row.validation, "latency_ms": row.latency_ms,
        "current_stage": (row.feature_snapshot or {}).get("current_stage"),
        "data_completeness_pct": round(sum(value is not None for value in (row.feature_snapshot or {}).values()) / 23 * 100, 1),
        "is_stale": stale, "unavailable_features": unavailable_features or [],
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
    consistency_errors = validate_project_consistency(project)
    if consistency_errors:
        raise ValueError("; ".join(consistency_errors))
    features, unavailable = build_features(project, population, snapshot_date)
    runtime = _runtime()
    result = await asyncio.to_thread(runtime.predict_features, features)
    stages = await asyncio.to_thread(runtime.predict_stages, features)
    # Keep the legacy project-list field as a denormalized reflection of the
    # production model. The score/category itself remains model-derived.
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
    return serialize_prediction(row, unavailable)


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
        return serialize_prediction(existing, unavailable)
    return await generate_prediction(db, project_id, now)


async def latest_prediction(db: AsyncSession, project_id) -> MLPrediction | None:
    result = await db.execute(select(MLPrediction).where(MLPrediction.project_id == project_id).order_by(MLPrediction.predicted_at.desc()).limit(1))
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
