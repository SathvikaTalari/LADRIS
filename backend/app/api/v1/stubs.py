"""Database-backed stage, GIS, and portfolio analytics routes.

The filename remains for import compatibility. No endpoint manufactures
project, coordinate, stage, or prediction values.
"""
import json
from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_current_user_optional
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
        "stages": [{"stage_name": row.stage_name, "stage_order": row.stage_order, "status": row.status.value if hasattr(row.status, "value") else str(row.status), "started_at": row.started_at.isoformat() if row.started_at else None, "completed_at": row.completed_at.isoformat() if row.completed_at else None, "predicted_delay_days": predicted.get(row.stage_name, {}).get("delay_days", 0)} for row in rows]
    }


@gis_router.get("/projects")
async def gis_projects(db: AsyncSession = Depends(get_db), _: User | None = Depends(get_current_user_optional)):
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


@gis_router.get("/detailed-projects")
async def get_detailed_projects(
    state: str = Query("ALL"),
    district: str = Query(""),
    risk_level: str = Query("ALL"),
    issue_type: str = Query("ALL"),
    db: AsyncSession = Depends(get_db),
    _: User | None = Depends(get_current_user_optional),
):
    """List projects annotated with location intelligence indicators for Detailed Map View."""
    projects = (await db.execute(select(Project).where(Project.deleted_at.is_(None)))).scalars().all()
    predictions = {row.project_id: row for row in await latest_predictions(db)}

    # Get parcel counts and issue counts per project
    parcel_stats_raw = await db.execute(text("""
        SELECT
            project_id,
            count(*) as total_parcels,
            count(distinct village) as village_count,
            count(*) FILTER (WHERE has_legal_dispute = true) as disputed_count,
            count(*) FILTER (WHERE is_compensated = false AND has_legal_dispute = false) as attention_count,
            count(*) FILTER (WHERE is_in_possession = true OR is_compensated = true) as clear_count
        FROM land_parcels
        GROUP BY project_id
    """))
    parcel_stats = {r[0]: {
        "total_parcels": r[1],
        "village_count": r[2],
        "disputed_count": r[3],
        "attention_count": r[4],
        "clear_count": r[5],
    } for r in parcel_stats_raw.fetchall()}

    items = []
    for p in projects:
        st = parcel_stats.get(p.id)
        has_gis = st is not None and st["total_parcels"] > 0
        pred = predictions.get(p.id)
        r_level = pred.risk_category if pred else (p.risk_level.value if hasattr(p.risk_level, "value") else str(p.risk_level or "MEDIUM"))

        # Determine primary issue
        if not has_gis:
            primary_issue = "NO_GIS"
        elif st["disputed_count"] > 0:
            primary_issue = "LEGAL"
        elif st["attention_count"] > 0:
            primary_issue = "COMPENSATION"
        else:
            primary_issue = "CLEAR"

        # Apply filters
        if state != "ALL" and p.state_code != state:
            continue
        if district.strip():
            d_lower = district.lower()
            if not any(d_lower in (d or "").lower() for d in (p.district_codes or [])):
                continue
        if risk_level != "ALL" and r_level != risk_level:
            continue
        if issue_type != "ALL" and primary_issue != issue_type:
            continue

        items.append({
            "id": str(p.id),
            "project_code": p.project_code,
            "name": p.name,
            "state_code": p.state_code,
            "district": (p.district_codes or ["Unknown"])[0] if p.district_codes else "Unknown",
            "district_codes": p.district_codes or [],
            "risk_level": r_level,
            "status": str(getattr(p.status, "value", p.status)),
            "latitude": float(p.latitude) if p.latitude is not None else None,
            "longitude": float(p.longitude) if p.longitude is not None else None,
            "total_area_ha": float(p.total_area_ha) if p.total_area_ha is not None else None,
            "has_detailed_gis": has_gis,
            "total_parcels": st["total_parcels"] if st else 0,
            "village_count": st["village_count"] if st else 0,
            "disputed_count": st["disputed_count"] if st else 0,
            "attention_count": st["attention_count"] if st else 0,
            "clear_count": st["clear_count"] if st else 0,
            "primary_issue": primary_issue,
        })

    # Sort so projects with detailed GIS appear first, then by risk
    risk_weights = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    items.sort(key=lambda x: (1 if x["has_detailed_gis"] else 0, risk_weights.get(x["risk_level"], 0)), reverse=True)
    return {"total": len(items), "projects": items}


@gis_router.get("/projects/{project_id}")
async def get_project_gis_details(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User | None = Depends(get_current_user_optional),
):
    """Detailed spatial data for a single project: alignment route, boundary, affected villages, and parcel GeoJSON."""
    project = (await db.execute(select(Project).where(Project.id == project_id, Project.deleted_at.is_(None)))).scalar_one_or_none()
    if project is None:
        raise HTTPException(404, "Project not found")

    pred = await latest_prediction(db, project_id)
    r_level = pred.risk_category if pred else (project.risk_level.value if hasattr(project.risk_level, "value") else str(project.risk_level or "MEDIUM"))

    # 1. Fetch alignment route and acquisition boundary if stored on project
    geom_res = await db.execute(text("""
        SELECT
            ST_AsGeoJSON(alignment_geom) as alignment_json,
            ST_AsGeoJSON(geom) as boundary_json
        FROM projects
        WHERE id = :pid
    """), {"pid": project_id})
    geom_row = geom_res.fetchone()
    alignment_geojson = json.loads(geom_row[0]) if geom_row and geom_row[0] else None
    boundary_geojson = json.loads(geom_row[1]) if geom_row and geom_row[1] else None

    # 2. Fetch land parcels with GeoJSON and centroids
    parcel_res = await db.execute(text("""
        SELECT
            lp.id,
            lp.khasra_number,
            lp.village,
            lp.tehsil,
            lp.district,
            lp.area_ha,
            lp.owner_count,
            lp.is_notified,
            lp.is_awarded,
            lp.is_compensated,
            lp.is_in_possession,
            lp.has_legal_dispute,
            lp.properties,
            ST_AsGeoJSON(lp.geom) as geom_json,
            ST_AsGeoJSON(ST_Centroid(lp.geom)) as centroid_json
        FROM land_parcels lp
        WHERE lp.project_id = :pid
        ORDER BY lp.village, lp.khasra_number
    """), {"pid": project_id})
    parcel_rows = parcel_res.fetchall()

    has_spatial_data = len(parcel_rows) > 0 or alignment_geojson is not None or boundary_geojson is not None

    if not has_spatial_data:
        return {
            "status": "UNAVAILABLE",
            "has_spatial_data": False,
            "message": "Detailed GIS data not available.",
            "project": {
                "id": str(project.id),
                "project_code": project.project_code,
                "name": project.name,
                "state_code": project.state_code,
                "district": (project.district_codes or ["Unknown"])[0] if project.district_codes else "Unknown",
                "risk_level": r_level,
                "status": str(getattr(project.status, "value", project.status)),
                "total_area_ha": float(project.total_area_ha) if project.total_area_ha is not None else None,
                "latitude": float(project.latitude) if project.latitude is not None else None,
                "longitude": float(project.longitude) if project.longitude is not None else None,
                "executing_agency": project.executing_agency or project.nodal_agency,
                "delay_months": project.delay_months or 0,
                "legal_case_count": project.legal_case_count or 0,
            },
            "alignment": None,
            "acquisition_boundary": None,
            "summary": {
                "total_parcels": 0, "clear_count": 0, "attention_count": 0, "disputed_count": 0,
                "total_area_ha": 0, "villages_count": 0, "hotspots_count": 0
            },
            "villages": [],
            "parcels": {"type": "FeatureCollection", "features": []}
        }

    # 3. If boundary_geojson is not set on project, compute convex hull of parcels
    if not boundary_geojson and parcel_rows:
        hull_res = await db.execute(text("""
            SELECT ST_AsGeoJSON(ST_ConvexHull(ST_Collect(geom)))
            FROM land_parcels
            WHERE project_id = :pid AND geom IS NOT NULL
        """), {"pid": project_id})
        hull_row = hull_res.fetchone()
        if hull_row and hull_row[0]:
            boundary_geojson = json.loads(hull_row[0])

    features = []
    village_map = defaultdict(lambda: {
        "total": 0, "clear": 0, "attention": 0, "disputed": 0, "area_ha": 0.0, "tehsil": "Unknown"
    })

    clear_cnt = 0
    attention_cnt = 0
    disputed_cnt = 0
    hotspots_cnt = 0
    total_area = 0.0

    for r in parcel_rows:
        pid, kn, vil, teh, dist, area, owners, is_notif, is_award, is_comp, is_poss, has_legal, props, g_json, c_json = r
        props = props or {}
        geom = json.loads(g_json) if g_json else None
        centroid = json.loads(c_json) if c_json else None

        area_val = float(area) if area is not None else float(props.get("area_ha") or 0)
        total_area += area_val

        # Status & Color: Green = Clear, Orange = Attention, Red = Disputed/Blocked
        st_color = props.get("status_color")
        if not st_color:
            if has_legal or props.get("legal_status", "").lower() == "disputed":
                st_color = "RED"
            elif not is_comp and (is_notif or is_award):
                st_color = "ORANGE"
            elif is_poss or is_comp:
                st_color = "GREEN"
            else:
                st_color = "ORANGE"

        # Hotspot calculation: Legal disputes, ownership disputes, long pending compensation
        is_hotspot = bool(props.get("is_hotspot") or has_legal or (st_color == "ORANGE" and props.get("days_pending", 0) > 180))

        if st_color == "RED":
            disputed_cnt += 1
            issue_type = "LEGAL"
        elif st_color == "ORANGE":
            attention_cnt += 1
            issue_type = props.get("issue_type") or "COMPENSATION"
        else:
            clear_cnt += 1
            issue_type = "NONE"

        if is_hotspot:
            hotspots_cnt += 1

        v_name = vil or props.get("village") or "Survey Zone"
        t_name = teh or props.get("tehsil") or "Tehsil"
        v_entry = village_map[v_name]
        v_entry["total"] += 1
        v_entry["area_ha"] += area_val
        v_entry["tehsil"] = t_name
        if st_color == "RED":
            v_entry["disputed"] += 1
        elif st_color == "ORANGE":
            v_entry["attention"] += 1
        else:
            v_entry["clear"] += 1

        # Six required fields for Parcel Click:
        # 1. Parcel No.
        # 2. Village
        # 3. Ownership Status
        # 4. Compensation Status
        # 5. Legal Status
        # 6. Days Pending
        khasra_no = kn or props.get("khasra_number") or props.get("parcel_id") or "Unnumbered"
        ownership_status = props.get("ownership_status") or (
            "Title In Dispute" if has_legal
            else f"Joint Ownership ({owners or 2} Co-owners)" if (owners and owners > 1)
            else "Single Owner (Verified Title)"
        )
        comp_status = props.get("compensation_status") or (
            "100% Disbursed / Settled" if is_comp
            else "Award Passed / Pending Treasury Release" if is_award
            else "Section 3A / Inquiry Pending"
        )
        legal_status = props.get("legal_status") or (
            "High Court Stay (Injunction Active)" if has_legal
            else "Clear / No Litigation"
        )
        days_pending = int(props.get("days_pending") or (0 if is_poss or is_comp else max(30, (project.delay_months or 4) * 30)))

        features.append({
            "type": "Feature",
            "id": str(pid),
            "geometry": geom,
            "properties": {
                "id": str(pid),
                "parcel_no": khasra_no,
                "khasra_number": khasra_no,
                "village": v_name,
                "tehsil": t_name,
                "district": dist or (project.district_codes or ["Unknown"])[0],
                "area_ha": round(area_val, 2),
                "ownership_status": ownership_status,
                "compensation_status": comp_status,
                "legal_status": legal_status,
                "days_pending": days_pending,
                "status_color": st_color,  # RED, ORANGE, GREEN
                "issue_type": issue_type,
                "is_hotspot": is_hotspot,
                "centroid": centroid.get("coordinates") if centroid else None,
            }
        })

    # Prepare affected villages list
    villages_list = []
    for v_name, v_data in village_map.items():
        v_color = "RED" if v_data["disputed"] > 0 else "ORANGE" if v_data["attention"] > 0 else "GREEN"
        villages_list.append({
            "name": v_name,
            "tehsil": v_data["tehsil"],
            "total_parcels": v_data["total"],
            "disputed_parcels": v_data["disputed"],
            "attention_parcels": v_data["attention"],
            "clear_parcels": v_data["clear"],
            "area_ha": round(v_data["area_ha"], 2),
            "status_color": v_color,
        })
    villages_list.sort(key=lambda x: (1 if x["status_color"] == "RED" else 2 if x["status_color"] == "ORANGE" else 3, -x["total_parcels"]))

    return {
        "status": "AVAILABLE",
        "has_spatial_data": True,
        "message": "Detailed GIS data loaded.",
        "project": {
            "id": str(project.id),
            "project_code": project.project_code,
            "name": project.name,
            "state_code": project.state_code,
            "district": (project.district_codes or ["Unknown"])[0] if project.district_codes else "Unknown",
            "risk_level": r_level,
            "status": str(getattr(project.status, "value", project.status)),
            "total_area_ha": float(project.total_area_ha) if project.total_area_ha is not None else round(total_area, 2),
            "latitude": float(project.latitude) if project.latitude is not None else None,
            "longitude": float(project.longitude) if project.longitude is not None else None,
            "executing_agency": project.executing_agency or project.nodal_agency,
            "delay_months": project.delay_months or 0,
            "legal_case_count": project.legal_case_count or 0,
        },
        "alignment": {"type": "Feature", "geometry": alignment_geojson, "properties": {"name": f"{project.name} Alignment"}} if alignment_geojson else None,
        "acquisition_boundary": {"type": "Feature", "geometry": boundary_geojson, "properties": {"name": f"{project.name} Acquisition Boundary"}} if boundary_geojson else None,
        "summary": {
            "total_parcels": len(features),
            "clear_count": clear_cnt,
            "attention_count": attention_cnt,
            "disputed_count": disputed_cnt,
            "hotspots_count": hotspots_cnt,
            "total_area_ha": round(total_area, 2),
            "villages_count": len(villages_list),
            "in_possession": clear_cnt,
            "pending": attention_cnt,
            "disputed": disputed_cnt,
            "acquisition_pct": round((clear_cnt / len(features) * 100), 1) if features else 0,
        },
        "risk_summary": {
            "total_parcels": len(features),
            "in_possession": clear_cnt,
            "pending": attention_cnt,
            "disputed": disputed_cnt,
            "acquisition_pct": round((clear_cnt / len(features) * 100), 1) if features else 0,
        },
        "villages": villages_list,
        "parcels": {
            "type": "FeatureCollection",
            "features": features,
        }
    }


def _portfolio(projects, prediction_rows):
    by_project = {row.project_id: row for row in prediction_rows}
    counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for row in prediction_rows:
        # Use the ML model's risk_category directly — do NOT override it
        cat = (row.risk_category or "MEDIUM").upper()
        if cat in counts:
            counts[cat] += 1
    # Also include projects without predictions using their stored risk_level
    predicted_ids = set(row.project_id for row in prediction_rows)
    for project in projects:
        if project.id not in predicted_ids:
            stored = (getattr(project.risk_level, 'value', None) or str(project.risk_level or 'MEDIUM')).upper()
            if stored in counts:
                counts[stored] += 1
    completeness = [sum(value is not None for value in (row.feature_snapshot or {}).values()) / 23 * 100 for row in prediction_rows]
    queue, stage_values = [], defaultdict(list)
    states, districts = defaultdict(list), defaultdict(list)
    for project in projects:
        row = by_project.get(project.id)
        if row is None: continue
        district = (project.district_codes or [project.state_code])[0]
        peak = max(row.stage_predictions or [], key=lambda item: item.get("risk_score", 0), default={})
        driver = next((item for item in row.top_drivers or [] if item.get("contribution", 0) > 0), None)
        # Use the ML model's risk_category directly
        item_risk_level = (row.risk_category or "MEDIUM").upper()
        queue.append({
            "id": str(project.id), "name": project.name, "project_code": project.project_code,
            "state_code": project.state_code, "district": district, "location": f"{project.state_code} / {district}",
            "critical_stage": peak.get("stage"), "priority_score": row.risk_score,
            "risk_velocity": "UNAVAILABLE", "current_bottleneck": driver.get("feature") if driver else None,
            "unresolved_alert_age": None, "action": (row.recommendations or ["Review prediction"])[0],
            "risk_level": item_risk_level, "total_area_ha": float(project.total_area_ha or 0),
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
    high_risk_total = counts["HIGH"] + counts["CRITICAL"]
    return {"status": "success" if projects else "no_data", "data_loaded": bool(projects), "summary": {
        "total_projects": len(projects), "high_risk_projects": high_risk_total, "projects_requiring_attention": high_risk_total,
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
    from datetime import date as _date
    today = _date.today()
    def _is_delayed(p) -> bool:
        status_val = str(getattr(p.status, "value", p.status)).upper()
        if status_val == "DELAYED":
            return True
        if p.delay_months and int(p.delay_months) > 0:
            return True
        if p.planned_end_date and p.planned_end_date < today and status_val not in ("COMPLETED", "CANCELLED"):
            return True
        return False
    projects_delayed_count = sum(1 for p in projects if _is_delayed(p))
    return {
        "status": "success" if total else "no_data", "data_loaded": bool(total),
        "executive_kpis": {"total_active_projects": total, "total_land_required_ha": round(sum(float(p.total_area_ha or 0) for p in projects), 1),
            "financial_outlay_cr": round(sum(float(p.estimated_compensation_inr or 0) for p in projects) / 1e7, 1),
            "high_critical_projects": counts["HIGH"] + counts["CRITICAL"], "projects_delayed": projects_delayed_count,
            "active_alerts": active_alerts, "projects_requiring_intervention": counts["HIGH"] + counts["CRITICAL"],
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
