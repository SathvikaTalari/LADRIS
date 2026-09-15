"""Production ML API backed exclusively by the existing LightGBM bundle."""
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings
from app.dependencies import get_current_user
from app.models.project import Project
from app.models.ml_models import MLPrediction, MLModelRegistry
from app.models.user import User
from app.services.production_ml_service import generate_prediction, latest_prediction, latest_predictions, serialize_prediction, _runtime

router = APIRouter(prefix="/api/ml", tags=["Production ML"])


@router.post("/predict/{project_id}")
async def predict(project_id: UUID, snapshot_date: datetime | None = Query(None), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    try:
        return await generate_prediction(db, project_id, snapshot_date)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, {"prediction_status": "INSUFFICIENT_DATA", "errors": [str(exc)]}) from exc
    except FileNotFoundError as exc:
        raise HTTPException(503, f"Production model unavailable: {exc}") from exc


@router.get("/prediction/{project_id}")
async def get_prediction(project_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    row = await latest_prediction(db, project_id)
    if row is None:
        raise HTTPException(404, "No stored ML prediction for this project")
    return serialize_prediction(row)


@router.get("/explanation/{project_id}")
async def explanation(project_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    row = await latest_prediction(db, project_id)
    if row is None:
        raise HTTPException(404, "No stored ML prediction for this project")
    return {"project_id": str(project_id), "model_version": row.model_version, "top_drivers": row.top_drivers, "recommendations": row.recommendations}


@router.get("/stages/{project_id}")
async def stages(project_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    row = await latest_prediction(db, project_id)
    if row is None:
        raise HTTPException(404, "No stored ML prediction for this project")
    return {"project_id": str(project_id), "snapshot_date": row.snapshot_date, "current_stage": row.feature_snapshot.get("current_stage"), "prediction_method": "overall_model_stage_counterfactual", "standalone_stage_artifacts_available": False, "stages": row.stage_predictions}


@router.get("/high-risk")
async def high_risk(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    predictions = [row for row in await latest_predictions(db) if row.risk_category == "HIGH"]
    projects = {p.id: p for p in (await db.execute(select(Project).where(Project.id.in_([r.project_id for r in predictions])))).scalars().all()} if predictions else {}
    return {"count": len(predictions), "projects": [{**serialize_prediction(row), "project_name": projects[row.project_id].name if row.project_id in projects else None} for row in predictions]}


@router.get("/model-info")
async def model_info(_: User = Depends(get_current_user)):
    return _runtime().model_info()


@router.get("/monitoring")
async def monitoring(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    """Operational drift/quality status from real persisted predictions."""
    rows = await latest_predictions(db)
    info = _runtime().model_info()
    if not rows:
        return {"status": "INSUFFICIENT_DATA", "reason": "No stored predictions", "model_version": info["model_version"]}
    scores = [row.risk_score for row in rows]
    completeness = [sum(v is not None for v in (row.feature_snapshot or {}).values()) / 23 * 100 for row in rows]
    versions = sorted({row.model_version for row in rows})
    return {
        "status": "AVAILABLE",
        "model_version": info["model_version"],
        "prediction_count": len(rows),
        "risk_score_mean": round(sum(scores) / len(scores), 2),
        "risk_score_min": round(min(scores), 2),
        "risk_score_max": round(max(scores), 2),
        "mean_data_completeness_pct": round(sum(completeness) / len(completeness), 2),
        "model_version_drift": any(version != info["model_version"] for version in versions),
        "versions_observed": versions,
        "performance_drift": {"status": "INSUFFICIENT_OUTCOMES", "reason": "Live outcome labels are not yet available; no accuracy claim is made."},
        "feature_drift": {"status": "INSUFFICIENT_BASELINE", "reason": "The production metadata does not contain training feature distributions; missingness is monitored without fabricating PSI values."},
    }


@router.get("/retraining-status")
async def retraining_status(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    labeled = (await db.execute(select(func.count(Project.id)).where(
        Project.deleted_at.is_(None), Project.actual_end_date.is_not(None)
    ))).scalar_one()
    registry = (await db.execute(select(MLModelRegistry).where(MLModelRegistry.is_current.is_(True)))).scalar_one_or_none()
    return {
        "automatic_retraining": False,
        "quality_gate_required": True,
        "eligible": labeled >= 50,
        "known_outcome_projects": labeled,
        "minimum_required": 50,
        "active_model_version": registry.model_version if registry else _runtime().model_info()["model_version"],
        "reason": None if labeled >= 50 else "Insufficient leakage-safe completed outcomes for controlled retraining.",
    }


@router.get("/training-history")
async def training_history(_: User = Depends(get_current_user)):
    from pathlib import Path
    import json
    import math
    def safe(value):
        if isinstance(value, float) and not math.isfinite(value):
            return None
        if isinstance(value, dict):
            return {key: safe(item) for key, item in value.items()}
        if isinstance(value, list):
            return [safe(item) for item in value]
        return value
    history = []
    for path in sorted(Path(get_settings().MODELS_DIR).glob("*/metadata.json")):
        try:
            metadata = json.loads(path.read_text(encoding="utf-8"))
            history.append({"model_version": path.parent.name, "training_timestamp": metadata.get("training_timestamp"), "evaluation": safe(metadata.get("evaluation", {})), "metadata_status": "VALID"})
        except (OSError, json.JSONDecodeError) as exc:
            history.append({"model_version": path.parent.name, "training_timestamp": None, "evaluation": {}, "metadata_status": "INVALID", "error": str(exc)})
    return {"models": history, "count": len(history)}
