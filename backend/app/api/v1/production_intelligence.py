"""Decision-intelligence endpoints built from persisted production ML outputs."""
from collections import Counter, defaultdict
from datetime import datetime, timezone
from statistics import mean, pstdev
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_analyst
from app.models.ml_models import MLPrediction
from app.models.project import Project
from app.models.user import User
from app.services.production_ml_service import latest_prediction, latest_predictions

intelligence_router = APIRouter(prefix="/intelligence", tags=["Decision Intelligence"])


async def _projects(db):
    return list((await db.execute(select(Project).where(Project.deleted_at.is_(None)))).scalars().all())


async def _history(db, project_id):
    return list((await db.execute(select(MLPrediction).where(MLPrediction.project_id == project_id).order_by(MLPrediction.predicted_at))).scalars().all())


def _temporal(rows):
    observations = [{
        "timestamp": row.predicted_at.isoformat(), "anomaly_score": row.risk_score / 100,
        "data_completeness_pct": round(sum(v is not None for v in (row.feature_snapshot or {}).values()) / 23 * 100, 1),
        "stage_fingerprint_risk": max((item.get("risk_score", 0) for item in (row.stage_predictions or [])), default=None),
        "model_version": row.model_version, "source": "ml_predictions",
    } for row in rows]
    delta = rows[-1].risk_score - rows[0].risk_score if len(rows) >= 2 else None
    label = "INSUFFICIENT_DATA" if delta is None else "ESCALATING" if delta > 1 else "DE_ESCALATING" if delta < -1 else "STABLE"
    return observations, delta, label


@intelligence_router.get("/risk-history/{project_id}")
async def risk_history(project_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = await _history(db, project_id)
    observations, delta, label = _temporal(rows)
    scores = [row.risk_score for row in rows]
    return {
        "project_id": str(project_id), "output_type": "A", "output_type_label": "Stored ML prediction history",
        "temporal_data_available": len(rows) >= 2, "observation_count": len(rows), "observations": observations,
        "risk_trend": None if delta is None else delta / 100, "risk_trend_label": label,
        "escalation_events": [], "deescalation_events": [],
        "first_observation_date": rows[0].predicted_at.isoformat() if rows else None,
        "last_observation_date": rows[-1].predicted_at.isoformat() if rows else None,
        "score_statistics": {"min": min(scores), "max": max(scores), "mean": mean(scores), "range": max(scores) - min(scores)} if scores else None,
        "temporal_disclaimer": "Trend requires at least two persisted prediction snapshots.",
        "trend_note": None if delta is not None else "Insufficient historical observations.",
    }


@intelligence_router.get("/risk-dna/{project_id}")
async def risk_dna(project_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    row = await latest_prediction(db, project_id)
    if row is None:
        raise HTTPException(404, "No stored production ML prediction for this project")
    rows = await _history(db, project_id)
    observations, delta, label = _temporal(rows)
    completeness = round(sum(v is not None for v in (row.feature_snapshot or {}).values()) / 23 * 100, 1)
    peak = max(row.stage_predictions or [], key=lambda item: item.get("risk_score", 0), default={})
    driver = max(row.top_drivers or [], key=lambda item: abs(item.get("contribution", 0)), default={})
    return {
        "project_id": str(project_id), "output_type": "A", "output_label": "Production ML risk profile",
        "dna_composite_score": row.risk_score, "dna_tier": row.risk_category,
        "disclaimer": "The composite is the calibrated production-model risk score, not a separately calculated score.",
        "dimensions": {
            "anomaly_signal": {"score": row.risk_score, "weight": 1, "output_type": "A", "output_type_label": "ML risk", "description": "Calibrated delay-risk score", "risk_level": row.risk_category, "contribution": row.risk_score, "available": True},
            "stage_fingerprint": {"score": peak.get("risk_score", 0), "weight": 0, "output_type": "A", "output_type_label": "Stage counterfactuals", "description": "Overall model scored with each stage category", "peak_stage": peak.get("stage"), "peak_stage_value": peak.get("risk_score"), "stage_details": [{"stage_id": item["stage"], "risk": item["risk_score"], "risk_level": item["risk_category"], "data_basis": item.get("prediction_method"), "data_completeness": completeness, "coverage": "counterfactual"} for item in row.stage_predictions or []], "contribution": 0, "available": bool(row.stage_predictions)},
            "data_completeness": {"score": completeness, "weight": 0, "output_type": "B", "output_type_label": "Feature completeness", "description": "Non-null production inputs", "completeness_pct": completeness, "risk_contribution": 0},
            "shap_driver_severity": {"score": abs(driver.get("contribution", 0)), "weight": 0, "output_type": "A", "output_type_label": "SHAP", "description": "Largest absolute SHAP contribution", "top_driver_name": driver.get("feature"), "top_driver_contribution": driver.get("contribution", 0), "contribution": 0, "available": bool(driver)},
            "reliability": {"score": 0, "confidence_assessment": "UNAVAILABLE", "is_out_of_distribution": False, "ood_details": {"status": "UNAVAILABLE"}, "weight": 0, "risk_contribution": 0, "output_type": "B", "output_type_label": "Unavailable", "description": "Training distributions are not stored in metadata."},
        },
        "temporal": {"observations_available": len(rows) >= 2, "observation_count": len(rows), "observations": observations, "risk_trend": None if delta is None else delta / 100, "risk_trend_label": label, "temporal_disclaimer": "Actual stored snapshots only.", "output_type": "A", "output_type_label": "Prediction history"},
        "weights": {"production_ml_risk_score": 1}, "computed_at": datetime.now(timezone.utc).isoformat(),
        "provenance": {"model_version": row.model_version, "table": "ml_predictions"},
    }


def _stage_summary(rows):
    values = defaultdict(list)
    for row in rows:
        for item in row.stage_predictions or []:
            values[item["stage"]].append(float(item["risk_score"]))
    return {key: {"mean": mean(items), "std": pstdev(items) if len(items) > 1 else 0, "min": min(items), "max": max(items), "coverage_type": "overall_model_stage_counterfactual"} for key, items in values.items()}


@intelligence_router.get("/bottlenecks")
async def bottlenecks(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rows = await latest_predictions(db)
    summary = _stage_summary(rows)
    dominant = max(summary, key=lambda key: summary[key]["mean"], default=None)
    return {"output_type": "B", "output_type_label": "Portfolio stage counterfactual aggregation", "available": bool(rows), "n_projects_analyzed": len(rows), "n_total_projects": len(await _projects(db)), "national_summary": {"dominant_bottleneck": {"bottleneck_type": dominant.upper(), "label": dominant, "count": len(rows), "percentage": 100, "description": "Highest mean counterfactual stage risk", "typical_cause": "Not inferred", "confidence": {"level": "LOW", "label": "Counterfactual", "note": "No standalone stage artifacts"}, "sample_size": len(rows), "data_limitation": "Uses the overall model with stage changed"} if dominant else None, "mean_stage_risks": summary, "analysis_note": "No separate risk formula is used."}, "bottleneck_distribution": [], "state_bottlenecks": [], "cluster_analysis": {"available": False, "reason": "No statistically sufficient stage-model dataset", "clusters": None}, "data_provenance": {"table": "ml_predictions"}, "disclaimer": "Stage values are model counterfactuals, not standalone stage-model outputs.", "computed_at": datetime.now(timezone.utc).isoformat(), "reason": None if rows else "No predictions"}


@intelligence_router.get("/bottlenecks/{state_code}")
async def state_bottleneck(state_code: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    projects = {p.id for p in await _projects(db) if p.state_code == state_code.upper()}
    rows = [row for row in await latest_predictions(db) if row.project_id in projects]
    summary = _stage_summary(rows)
    dominant = max(summary, key=lambda key: summary[key]["mean"], default=None)
    return {"state_code": state_code.upper(), "available": bool(rows), "n_projects": len(rows), "dominant_bottleneck": dominant, "mean_stage_risks": summary, "data_limitation": "Overall-model stage counterfactuals; no standalone stage artifacts."}


def _similarity(left, right):
    fields = ["project_type", "state", "current_stage"]
    return sum(left.get(field) == right.get(field) for field in fields) / len(fields) * 100


@intelligence_router.get("/comparable-projects/{project_id}")
async def comparable(project_id: UUID, top_k: int = Query(5, ge=1, le=20), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    target = await latest_prediction(db, project_id)
    if target is None: raise HTTPException(404, "No stored production ML prediction")
    projects = {p.id: p for p in await _projects(db)}
    candidates = [(row, _similarity(target.feature_snapshot or {}, row.feature_snapshot or {})) for row in await latest_predictions(db) if row.project_id != project_id]
    candidates.sort(key=lambda item: item[1], reverse=True)
    result = [{"rank": index, "project_id": str(row.project_id), "project_code": projects[row.project_id].project_code, "project_name": projects[row.project_id].name, "state_code": projects[row.project_id].state_code, "executing_agency": projects[row.project_id].executing_agency, "total_area_ha": float(projects[row.project_id].total_area_ha or 0), "status": projects[row.project_id].status.value, "risk_level": row.risk_category, "similarity_score": score, "similarity_tier": "HIGH" if score >= 67 else "MODERATE" if score >= 34 else "LOW", "similarity_explanation": [], "top_shared_features": [field for field in ["project_type", "state", "current_stage"] if (target.feature_snapshot or {}).get(field) == (row.feature_snapshot or {}).get(field)], "comparability_note": "Categorical feature match only; outcomes are not used."} for index, (row, score) in enumerate(candidates[:top_k], 1)]
    return {"project_id": str(project_id), "output_type": "C", "output_type_label": "Leakage-safe project similarity", "available": bool(result), "n_comparables_found": len(result), "n_projects_searched": len(candidates), "algorithm": "categorical exact-match similarity", "feature_space": "production feature snapshots", "features_used": ["project_type", "state", "current_stage"], "comparable_projects": result, "disclaimer": "Similarity is descriptive and does not alter ML risk.", "methodology_note": "No completion outcomes or future fields are used.", "computed_at": datetime.now(timezone.utc).isoformat(), "reason": None if result else "No other predictions"}


def _resource(driver):
    feature = (driver or {}).get("feature", "")
    if "legal" in feature or "dispute" in feature: return {"type": "LEGAL", "label": "Legal review capacity"}
    if "compensation" in feature or "disbursement" in feature: return {"type": "COMPENSATION", "label": "Compensation team"}
    if "rehabilitation" in feature or "resettlement" in feature: return {"type": "RR", "label": "R&R team"}
    return {"type": "GENERAL", "label": "Administrative review"}


async def _queue(db, state=None, agency=None, tier=None):
    projects = {p.id: p for p in await _projects(db)}
    entries = []
    for row in await latest_predictions(db):
        project = projects[row.project_id]
        if state and project.state_code != state.upper(): continue
        if agency and agency.lower() not in (project.executing_agency or "").lower(): continue
        if tier and row.risk_category != tier.upper(): continue
        driver = next((d for d in row.top_drivers or [] if d.get("contribution", 0) > 0), None)
        resource = _resource(driver)
        peak = max(row.stage_predictions or [], key=lambda item: item.get("risk_score", 0), default={})
        entries.append({"project_id": str(project.id), "project_code": project.project_code, "project_name": project.name, "state_code": project.state_code, "executing_agency": project.executing_agency, "status": project.status.value, "composite_priority_score": row.risk_score, "queue_tier": row.risk_category, "score_breakdown": {"base_priority_score": row.risk_score, "bottleneck_modifier": 0, "comparable_context_modifier": 0, "phase4_components": None}, "risk_signals": {"anomaly_score": row.delay_probability, "stage_fingerprint_risk": peak.get("risk_score", row.risk_score) / 100, "peak_risk_stage": peak.get("stage"), "effective_risk_severity": row.delay_probability}, "bottleneck_type": resource["type"] if resource["type"] in {"LEGAL", "COMPENSATION", "RR"} else None, "recommended_resource": resource, "data_completeness_pct": round(sum(v is not None for v in (row.feature_snapshot or {}).values()) / 23 * 100, 1), "output_type": "D", "output_type_label": "ML risk ranking", "scoring_note": "Ranked directly by production ML risk score."})
    entries.sort(key=lambda item: item["composite_priority_score"], reverse=True)
    for index, item in enumerate(entries, 1): item["rank"] = index
    return entries


@intelligence_router.get("/priority-queue")
async def priority_queue(filter_state: str | None = None, filter_agency: str | None = None, filter_tier: str | None = None, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    queue = await _queue(db, filter_state, filter_agency, filter_tier)
    return {"output_type": "D", "output_type_label": "Production ML risk queue", "total_projects": len(queue), "tier_summary": dict(Counter(item["queue_tier"] for item in queue)), "active_filters": {"state": filter_state, "agency": filter_agency, "tier": filter_tier}, "queue": queue, "queue_disclaimer": "Priority equals the production model risk score; no independent risk scoring is applied.", "computed_at": datetime.now(timezone.utc).isoformat()}


@intelligence_router.post("/resource-scenario")
async def resource_scenario(payload: dict[str, Any], db: AsyncSession = Depends(get_db), _: User = Depends(require_analyst)):
    capacities = {key: max(0, int(value)) for key, value in (payload.get("capacity_constraints") or {}).items()}
    remaining = dict(capacities)
    queue = await _queue(db, payload.get("filter_state"), payload.get("filter_agency"))
    assigned, deferred = [], []
    for item in queue:
        resource = item["recommended_resource"]["type"]
        if remaining.get(resource, 0) > 0:
            remaining[resource] -= 1
            assigned.append({**item, "allocation_status": "ASSIGNED", "assigned_resource_type": resource, "assigned_resource_label": item["recommended_resource"]["label"], "allocation_note": "Assigned in descending stored ML risk order."})
        else:
            deferred.append({**item, "allocation_status": "DEFERRED", "deferral_reason": f"No {resource} capacity supplied"})
    return {"output_type": "E", "output_type_label": "Capacity scenario", "simulation_type": "deterministic_capacity_assignment", "disclaimer": "Decision-support allocation only; no project or prediction records are changed.", "input_constraints": capacities, "total_projects": len(queue), "assigned_count": len(assigned), "deferred_count": len(deferred), "remaining_capacity": remaining, "assigned_projects": assigned, "deferred_projects": deferred, "simulation_note": "Uses ML risk ordering and SHAP-driver resource mapping.", "computed_at": datetime.now(timezone.utc).isoformat(), "available": True, "reason": None}


@intelligence_router.get("/gis-heatmap")
async def gis_heatmap(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    projects = {p.id: p for p in await _projects(db)}
    points, unavailable = [], []
    for row in await latest_predictions(db):
        project = projects[row.project_id]
        if project.latitude is None or project.longitude is None:
            unavailable.append({"project_id": str(project.id), "project_code": project.project_code, "reason": "Exact coordinates unavailable"}); continue
        points.append({"district": (project.district_codes or [project.state_code])[0], "state_code": project.state_code, "lat": float(project.latitude), "lng": float(project.longitude), "heat_intensity": row.risk_score, "dominant_risk_level": row.risk_category, "project_count": 1, "avg_risk_score": row.risk_score, "issues": [d.get("feature") for d in row.top_drivers or [] if d.get("contribution", 0) > 0][:3], "top_projects": [{"id": str(project.id), "name": project.name, "project_code": project.project_code, "risk_level": row.risk_category, "risk_score": row.risk_score}]})
    return {"status": "AVAILABLE" if points else "INSUFFICIENT_GIS_DATA", "total_locations": len(points), "total_projects": len(projects), "coordinate_source": "PROJECT_RECORD", "heatmap_points": points, "unavailable_projects": unavailable, "signals_used": ["Persisted calibrated LightGBM risk score"]}


@intelligence_router.get("/risk-velocity/{project_id}")
async def risk_velocity(project_id: UUID, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user), risk_type: str = "delay_risk"):
    rows = await _history(db, project_id); _, delta, label = _temporal(rows)
    return {"project_id": str(project_id), "status": "AVAILABLE" if delta is not None else "INSUFFICIENT_HISTORY", "velocity": delta, "trend_label": label, "observation_count": len(rows), "disclaimer": "Computed only from stored production prediction snapshots."}


@intelligence_router.get("/risk-velocity-summary")
async def risk_velocity_summary(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return {"status": "INSUFFICIENT_HISTORY", "projects": [], "reason": "Per-project prediction history is required."}
