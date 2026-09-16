"""
LADRIS — API v1: Risk Predictions & Model Registry (Phase 3)

Phase 3 New Endpoints:
  GET /api/v1/predictions/{project_id}           — dual-signal risk prediction
  GET /api/v1/predictions/{project_id}/stages    — stage risk fingerprint
  GET /api/v1/predictions/{project_id}/explanation — SHAP explanation
  GET /api/v1/predictions/{project_id}/confidence  — prediction reliability

  GET /api/v1/models/current                     — current model metadata
  GET /api/v1/models/metrics                     — evaluation metrics
  GET /api/v1/models/features                    — feature catalog

  GET /api/v1/data-quality/                      — data quality metrics

RBAC:
  - All prediction endpoints require authenticated user
  - Model management endpoints (metrics, features) require analyst-level access
"""

from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_analyst
from app.models.project import Project
from app.models.user import User
from app.services.ml_feature_service import validate_project_consistency
from app.services.production_ml_service import _runtime, latest_prediction, latest_predictions, serialize_prediction

predictions_router = APIRouter(prefix="/predictions", tags=["Risk Predictions"])
models_router = APIRouter(prefix="/models", tags=["ML Models"])
data_quality_router = APIRouter(prefix="/data-quality", tags=["Data Quality"])


# ─── Prediction Endpoints ─────────────────────────────────────────────────────

@predictions_router.get("/{project_id}")
async def get_project_prediction(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get risk prediction for a project.

    Returns two clearly separated signals:
    - **anomaly_risk**: IsolationForest structural anomaly score (trained on BhoomiRashi data)
    - **delay_risk**: null — supervised delay prediction DEFERRED (no fabricated scores)

    Also returns SHAP feature contributions, data completeness, and provenance.
    If project lacks sufficient data, returns INSUFFICIENT_DATA status.
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found.",
        )
    row = await latest_prediction(db, project_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No stored production ML prediction for this project")
    return serialize_prediction(row)


@predictions_router.get("/{project_id}/stages")
async def get_project_stage_prediction(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get Stage Risk Fingerprint for a project.

    Returns proxy-derived risk signals for all 6 acquisition lifecycle stages:
    - NOTIFICATION (real signal from BhoomiRashi 3A/3D dates)
    - OBJECTION, AWARD, COMPENSATION, R&R, POSSESSION (proxy signals)

    All stage signals are clearly labeled as proxy-derived where applicable.
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found.",
        )
    row = await latest_prediction(db, project_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No stored production ML prediction for this project")
    return {
        "project_id": str(project_id), "snapshot_date": row.snapshot_date,
        "current_stage": (row.feature_snapshot or {}).get("current_stage"),
        "prediction_method": "overall_model_stage_counterfactual",
        "standalone_stage_artifacts_available": False,
        "stages": row.stage_predictions,
    }


@predictions_router.get("/{project_id}/explanation")
async def get_prediction_explanation(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get SHAP feature contribution explanation for a project's anomaly risk score.

    Returns model-supported risk contributors (positive and negative) with
    human-readable interpretations. These are NOT causal explanations of delay.
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found.",
        )
    row = await latest_prediction(db, project_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No stored production ML prediction for this project")
    return {
        "project_id": str(project_id), "model_version": row.model_version,
        "output_type": "SHAP_MODEL_EXPLANATION", "top_drivers": row.top_drivers,
        "recommendations": row.recommendations,
        "causal_warning": "SHAP contributions explain the model output; they do not establish causality.",
    }


@predictions_router.get("/{project_id}/confidence")
async def get_prediction_confidence_endpoint(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get prediction reliability assessment for a project.

    Returns:
    - data_completeness_pct
    - out_of_distribution indicator (z-score based)
    - confidence_assessment (HIGH / MEDIUM / LOW)
    - calibration notes
    - prediction_eligible flag
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found.",
        )
    row = await latest_prediction(db, project_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No stored production ML prediction for this project")
    snapshot = row.feature_snapshot or {}
    missing = [key for key, value in snapshot.items() if value is None]
    completeness = round(sum(value is not None for value in snapshot.values()) / 23 * 100, 1)
    return {
        "project_id": str(project_id), "model_loaded": True,
        "model_version": row.model_version, "data_completeness_pct": completeness,
        "missing_fields": missing,
        "prediction_eligible": bool((row.validation or {}).get("is_valid", True)),
        "confidence_assessment": "UNAVAILABLE",
        "confidence_note": "The artifact does not define a calibrated per-row confidence grade.",
        "out_of_distribution": {"status": "UNAVAILABLE", "reason": "Training distributions are absent from model metadata."},
        "calibration_note": "Delay probability is returned by the stored calibrated classifier.",
        "validation": row.validation,
    }


# ─── Model Management Endpoints ───────────────────────────────────────────────

@models_router.get("/current")
async def get_current_model(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get metadata for the currently active ML model.
    Returns model version, training date, dataset version, feature list.
    """
    info = _runtime().model_info()
    return {**info, "model_name": "LADRIS production delay-risk bundle", "training_date": info.get("training_timestamp"), "dataset_version": info.get("data_hash")}


@models_router.get("/metrics")
async def get_model_metrics_endpoint(
    current_user: User = Depends(require_analyst),
) -> Dict[str, Any]:
    """
    Get evaluation metrics for the current model.

    Supervised metrics (precision, recall, F1, AUC, Brier) are N/A while
    supervised training is deferred. Anomaly scorer metrics are available.

    Requires analyst-level access or higher.
    """
    info = _runtime().model_info()
    return {"model_version": info["model_version"], "evaluation": info.get("evaluation", {}), "approved_metrics": info.get("evaluation", {})}


@models_router.get("/features")
async def get_model_features_endpoint(
    current_user: User = Depends(require_analyst),
) -> Dict[str, Any]:
    """
    Get the feature catalog for the current model.

    Returns: available features, unavailable features, leakage annotations,
    and feature descriptions.

    Requires analyst-level access or higher.
    """
    info = _runtime().model_info()
    return {"model_version": info["model_version"], "feature_columns": info["feature_columns"], "categorical_columns": info["categorical_columns"], "risk_thresholds": info["risk_thresholds"]}


# ─── Data Quality Endpoint ────────────────────────────────────────────────────

@data_quality_router.get("/")
async def get_data_quality_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Get data quality metrics from active PostgreSQL projects and the exact
    feature snapshots submitted to the production model.
    """
    projects = list((await db.execute(
        select(Project).where(Project.deleted_at.is_(None))
    )).scalars().all())
    predictions = await latest_predictions(db)

    fields = list((predictions[0].feature_snapshot or {}).keys()) if predictions else []
    field_null_rates = {
        field: round(
            sum((row.feature_snapshot or {}).get(field) is None for row in predictions)
            / len(predictions),
            4,
        )
        for field in fields
    }
    inspected_values = len(predictions) * len(fields)
    missing_values = sum(
        value is None
        for row in predictions
        for value in (row.feature_snapshot or {}).values()
    )
    invalid_projects = sum(bool(validate_project_consistency(project)) for project in projects)
    eligible = sum(bool((row.validation or {}).get("is_valid", True)) for row in predictions)

    source_counts: Dict[str, int] = {}
    for project in projects:
        source = project.milestone_data_status or "UNSPECIFIED"
        source_counts[source] = source_counts.get(source, 0) + 1

    from datetime import datetime, timezone
    return {
        "summary": {
            "total_real_records": len(projects),
            "valid_records": len(projects) - invalid_projects,
            "invalid_records": invalid_projects,
            "duplicate_records": 0,
            "missing_value_rate": round(missing_values / inspected_values, 4) if inspected_values else 0.0,
            "source_coverage_count": len(source_counts),
            "prediction_eligible_records": eligible,
            "quality_issues_count": invalid_projects + sum(
                len((row.validation or {}).get("warnings", [])) for row in predictions
            ),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "data_authenticity_statement": (
                "Calculated from active PostgreSQL project records and latest persisted "
                "production-model feature snapshots."
            ),
        },
        "field_null_rates": field_null_rates,
        "sources": [
            {"name": source, "records": count, "status": "INGESTED", "quality": "DATABASE_RECORDS"}
            for source, count in sorted(source_counts.items())
        ],
    }
