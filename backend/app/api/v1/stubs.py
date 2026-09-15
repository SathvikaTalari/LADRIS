"""Database-backed stage, GIS, and portfolio analytics routes.

The filename remains for import compatibility. No endpoint manufactures
project, coordinate, stage, or prediction values.
"""
from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.misc import Alert, AlertStatus
from app.models.ml_models import MLPrediction
from app.models.project import Project
from app.models.stage import ProjectStage
from app.models.user import User
from app.services.production_ml_service import latest_prediction, latest_predictions
from app.services.ml_feature_service import STAGE_MAP

stages_router = APIRouter(prefix="/stages", tags=["Project Stages"])
gis_router = APIRouter(prefix="/gis", tags=["GIS"])
analytics_router = APIRouter(prefix="/analytics", tags=["Analytics"])


@stages_router.get("/{project_id}")
async def list_stages(project_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    project = (await db.execute(select(Project).where(Project.id == project_id, Project.deleted_at.is_(None)))).scalar_one_or_none()
    if project is None:
        raise HTTPException(404, "Project not found")
    rows = (await db.execute(select(ProjectStage).where(ProjectStage.project_id == project_id).order_by(ProjectStage.stage_order))).scalars().all()
    prediction = await latest_prediction(db, project_id)
    predicted = {item["stage"]: item for item in (prediction.stage_predictions or [])} if prediction else {}
    return {
        "status": "AVAILABLE" if rows else "UNAVAILABLE", "project_id": str(project_id),
        "observed_stage": (prediction.feature_snapshot or {}).get("current_stage") if prediction else None,
        "prediction_method": "overall_model_stage_counterfactual" if prediction else None,
        "stages": [{
            "stage_name": row.stage_name.value, "stage_order": row.stage_order,
            "observed_status": row.status.value, "planned_start_date": row.planned_start_date,
            "planned_end_date": row.planned_end_date, "actual_start_date": row.actual_start_date,
            "actual_end_date": row.actual_end_date,
            "prediction": predicted.get(STAGE_MAP.get(row.stage_name.value)),
        } for row in rows],
    }


@gis_router.get("/projects")
async def gis_projects(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    projects = (await db.execute(select(Project).where(Project.deleted_at.is_(None)))).scalars().all()
    predictions = {row.project_id: row for row in await latest_predictions(db)}
    features, unavailable = [], []
    for project in projects:
        if project.latitude is None or project.longitude is None:
            unavailable.append({"id": str(project.id), "project_code": project.project_code, "reason": "latitude/longitude unavailable"})
            continue
        prediction = predictions.get(project.id)
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [float(project.longitude), float(project.latitude)]}, "properties": {
            "id": str(project.id), "project_code": project.project_code, "name": project.name,
            "state_code": project.state_code, "risk_level": prediction.risk_category if prediction else "UNKNOWN",
            "risk_score": prediction.risk_score if prediction else None,
            "executing_agency": project.executing_agency or project.nodal_agency,
            "total_area_ha": float(project.total_area_ha) if project.total_area_ha is not None else None,
            "coordinate_source": "project_record",
        }})
    return {"status": "AVAILABLE" if features else "INSUFFICIENT_GIS_DATA", "type": "FeatureCollection", "features": features, "unavailable_projects": unavailable}


def _portfolio(projects, prediction_rows):
    by_project = {row.project_id: row for row in prediction_rows}
    counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for row in prediction_rows: counts[row.risk_category] = counts.get(row.risk_category, 0) + 1
    completeness = [sum(value is not None for value in (row.feature_snapshot or {}).values()) / 23 * 100 for row in prediction_rows]
    queue, stage_values = [], defaultdict(list)
    states, districts = defaultdict(list), defaultdict(list)
    for project in projects:
        row = by_project.get(project.id)
        if row is None: continue
        district = (project.district_codes or [project.state_code])[0]
        peak = max(row.stage_predictions or [], key=lambda item: item.get("risk_score", 0), default={})
        driver = next((item for item in row.top_drivers or [] if item.get("contribution", 0) > 0), None)
        queue.append({
            "id": str(project.id), "name": project.name, "project_code": project.project_code,
            "state_code": project.state_code, "district": district, "location": f"{project.state_code} / {district}",
            "critical_stage": peak.get("stage"), "priority_score": row.risk_score,
            "risk_velocity": "UNAVAILABLE", "current_bottleneck": driver.get("feature") if driver else None,
            "unresolved_alert_age": None, "action": (row.recommendations or ["Review prediction"])[0],
            "risk_level": row.risk_category, "total_area_ha": float(project.total_area_ha or 0),
            "delay_probability": row.delay_probability,
            "latitude": float(project.latitude) if project.latitude is not None else None,
            "longitude": float(project.longitude) if project.longitude is not None else None,
        })
        states[project.state_code].append(row.risk_score)
        districts[(district, project.state_code)].append(row.risk_score)
        for item in row.stage_predictions or []: stage_values[item["stage"]].append(float(item["risk_score"]))
    queue.sort(key=lambda item: item["priority_score"], reverse=True)
    for index, item in enumerate(queue[:10], 1): item["priority_rank"] = index
    stages = [{"stage": key, "risk_pct": round(sum(values) / len(values), 1)} for key, values in stage_values.items()]
    highest = max(stages, key=lambda item: item["risk_pct"], default=None)
    for item in stages: item["is_bottleneck"] = item is highest
    top_states = sorted(({"code": key, "state": key, "score": round(sum(values) / len(values), 1)} for key, values in states.items()), key=lambda item: item["score"], reverse=True)
    top_districts = sorted(({"district": key[0], "state": key[1], "score": round(sum(values) / len(values), 1)} for key, values in districts.items()), key=lambda item: item["score"], reverse=True)
    average = round(sum(completeness) / len(completeness), 1) if completeness else 0
    return counts, queue[:10], stages, highest, top_states, top_districts, average


@analytics_router.get("/overview")
async def analytics_overview(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    projects = (await db.execute(select(Project).where(Project.deleted_at.is_(None)))).scalars().all()
    predictions = await latest_predictions(db)
    counts, *_ = _portfolio(projects, predictions)
    delay_values = [row.predicted_delay_days for row in predictions if row.predicted_delay_days is not None]
    return {"status": "success" if projects else "no_data", "data_loaded": bool(projects), "summary": {
        "total_projects": len(projects), "high_risk_projects": counts["HIGH"], "projects_requiring_attention": counts["HIGH"],
        "average_delay_days": round(sum(delay_values) / len(delay_values), 1) if delay_values else None,
        "total_area_ha": round(sum(float(project.total_area_ha or 0) for project in projects), 1),
        "total_affected_families": sum(project.total_affected_families or 0 for project in projects),
    }}


@analytics_router.get("/executive")
async def analytics_executive(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    projects = (await db.execute(select(Project).where(Project.deleted_at.is_(None)))).scalars().all()
    predictions = await latest_predictions(db)
    active_alerts = (await db.execute(select(func.count(Alert.id)).where(Alert.status == AlertStatus.ACTIVE))).scalar_one()
    counts, queue, stages, highest, states, districts, completeness = _portfolio(projects, predictions)
    total = len(projects)
    return {
        "status": "success" if total else "no_data", "data_loaded": bool(total),
        "executive_kpis": {"total_active_projects": total, "total_land_required_ha": round(sum(float(p.total_area_ha or 0) for p in projects), 1),
            "financial_outlay_cr": round(sum(float(p.estimated_compensation_inr or 0) for p in projects) / 1e7, 1),
            "high_critical_projects": counts["HIGH"], "projects_delayed": sum(str(getattr(p.status, "value", p.status)) == "DELAYED" for p in projects),
            "active_alerts": active_alerts, "projects_requiring_intervention": counts["HIGH"],
            "avg_data_completeness": completeness, "data_trust_score": round(completeness)},
        "ai_reliability_distinction": {"prediction_status": {"available": len(predictions), "unavailable_deferred": total - len(predictions), "low_reliability": sum(not (row.validation or {}).get("is_valid", True) for row in predictions)}},
        "needs_attention_today": queue, "risk_distributions": {"verified_delay_risk": counts},
        "stage_bottlenecks": {"stages": stages, "dominant_national_bottleneck": highest["stage"] if highest else None},
        "risk_velocity": {"trend_months": [], "breakdown": {}, "status": "INSUFFICIENT_HISTORY"},
        "state_district_comparison": {"top_states": states, "top_districts": districts},
        "data_health": {"total_projects": total, "prediction_available": len(predictions), "prediction_unavailable": total - len(predictions), "average_trust_score": round(completeness)},
    }


@analytics_router.get("/risk-trend")
async def risk_trend(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (await db.execute(select(MLPrediction).join(Project).where(Project.deleted_at.is_(None)).order_by(MLPrediction.predicted_at))).scalars().all()
    grouped = defaultdict(list)
    for row in rows: grouped[row.predicted_at.date().isoformat()].append(row.risk_score)
    trend = [{"date": date, "average_risk_score": round(sum(values) / len(values), 2), "prediction_count": len(values)} for date, values in grouped.items()]
    return {"status": "AVAILABLE" if len(trend) >= 2 else "INSUFFICIENT_HISTORY", "trend": trend}


@analytics_router.get("/district-summary")
async def district_summary(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    projects = (await db.execute(select(Project).where(Project.deleted_at.is_(None)))).scalars().all()
    by_project = {row.project_id: row for row in await latest_predictions(db)}
    grouped = defaultdict(list)
    for project in projects:
        if project.id in by_project: grouped[((project.district_codes or [project.state_code])[0], project.state_code)].append(by_project[project.id])
    districts = [{"district": key[0], "state_code": key[1], "project_count": len(rows), "average_risk_score": round(sum(row.risk_score for row in rows) / len(rows), 2), "high_risk_projects": sum(row.risk_category == "HIGH" for row in rows)} for key, rows in grouped.items()]
    districts.sort(key=lambda item: item["average_risk_score"], reverse=True)
    return {"status": "AVAILABLE" if districts else "NO_DATA", "districts": districts}
