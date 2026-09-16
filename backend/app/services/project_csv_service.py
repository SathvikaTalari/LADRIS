"""Synchronize inference projects from the configured raw CSV into PostgreSQL.

The CSV is an input source only. Outcome columns used during training are
intentionally ignored so they can never leak into live predictions.
"""
from __future__ import annotations

import csv
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project import AcquisitionAct, Project, ProjectStatus, ProjectType, RiskLevel
from app.models.stage import ProjectStage, StageName, StageStatus

SOURCE_MARKER = "RAW_CSV"

PROJECT_TYPES = {
    "highway": ProjectType.HIGHWAY,
    "railway": ProjectType.RAILWAY,
    "airport": ProjectType.AIRPORT,
    "power": ProjectType.POWER_TRANSMISSION,
    "pipeline": ProjectType.PIPELINE,
    "irrigation": ProjectType.IRRIGATION,
    "urban": ProjectType.URBAN_DEVELOPMENT,
    "industrial": ProjectType.INDUSTRIAL_CORRIDOR,
    "defence": ProjectType.DEFENCE,
    "other": ProjectType.OTHER,
}

TYPE_TO_RAW = {v: k for k, v in PROJECT_TYPES.items()}

CODE_TO_STATE = {
    "AP": "Andhra Pradesh", "AR": "Arunachal Pradesh", "AS": "Assam", "BR": "Bihar",
    "CG": "Chhattisgarh", "GA": "Goa", "GJ": "Gujarat", "HR": "Haryana",
    "HP": "Himachal Pradesh", "JH": "Jharkhand", "KA": "Karnataka", "KL": "Kerala",
    "MP": "Madhya Pradesh", "MH": "Maharashtra", "MN": "Manipur", "ML": "Meghalaya",
    "MZ": "Mizoram", "NL": "Nagaland", "OD": "Odisha", "PB": "Punjab", "RJ": "Rajasthan",
    "SK": "Sikkim", "TN": "Tamil Nadu", "TS": "Telangana", "TG": "Telangana", "TR": "Tripura",
    "UP": "Uttar Pradesh", "UK": "Uttarakhand", "WB": "West Bengal", "DL": "Delhi",
    "JK": "Jammu and Kashmir", "LA": "Ladakh", "PY": "Puducherry",
}

RAW_CSV_FIELDNAMES = [
    "Project ID",
    "Project Name",
    "Project Type",
    "Implementing Agency",
    "State",
    "District",
    "Land Area (ha)",
    "Affected Families",
    "Notification Date",
    "Expected Completion",
    "Actual Completion",
    "Current Stage",
    "Delayed (Y/N)",
    "Delay (days)",
    "Compensation Sanctioned",
    "Compensation Disbursed",
    "Open Disputes",
    "R&R Progress %",
    "Latitude",
    "Longitude",
]

STATE_CODES = {
    "andhra pradesh": "AP", "assam": "AS", "bihar": "BR", "chhattisgarh": "CG",
    "delhi": "DL", "gujarat": "GJ", "haryana": "HR", "karnataka": "KA",
    "kerala": "KL", "madhya pradesh": "MP", "maharashtra": "MH", "odisha": "OD",
    "punjab": "PB", "rajasthan": "RJ", "tamil nadu": "TN", "telangana": "TG",
    "uttar pradesh": "UP", "uttarakhand": "UK", "west bengal": "WB",
}

STAGES = [
    ("notification", StageName.PRELIMINARY_NOTIFICATION),
    ("survey", StageName.SOCIAL_IMPACT_ASSESSMENT),
    ("approval", StageName.EXPERT_GROUP_REVIEW),
    ("compensation", StageName.COMPENSATION_DISBURSEMENT),
    ("legal_resolution", StageName.SECTION_21_OBJECTIONS),
    ("rehabilitation", StageName.REHABILITATION_RESETTLEMENT),
    ("possession", StageName.POSSESSION),
    ("completed", StageName.PROJECT_HANDOVER),
]

DISTRICT_COORDINATES = {
    ("nalgonda", "ts"): (17.0577, 79.2684),
    ("nalgonda", "telangana"): (17.0577, 79.2684),
    ("bengaluru rural", "ka"): (13.2847, 77.5877),
    ("bengaluru rural", "karnataka"): (13.2847, 77.5877),
    ("karimnagar", "ts"): (18.4386, 79.1288),
    ("karimnagar", "telangana"): (18.4386, 79.1288),
    ("guntur", "ap"): (16.3067, 80.4365),
    ("guntur", "andhra pradesh"): (16.3067, 80.4365),
    ("nagpur", "mh"): (21.1458, 79.0882),
    ("nagpur", "maharashtra"): (21.1458, 79.0882),
    ("jaipur", "rj"): (26.9124, 75.7873),
    ("jaipur", "rajasthan"): (26.9124, 75.7873),
    ("varanasi", "up"): (25.3176, 82.9739),
    ("varanasi", "uttar pradesh"): (25.3176, 82.9739),
    ("khammam", "ts"): (17.2473, 80.1514),
    ("khammam", "telangana"): (17.2473, 80.1514),
    ("lucknow", "up"): (26.8467, 80.9462),
    ("pune", "mh"): (18.5204, 73.8567),
    ("ahmedabad", "gj"): (23.0225, 72.5714),
    ("patna", "br"): (25.5941, 85.1376),
    ("bhopal", "mp"): (23.2599, 77.4126),
}


def _text(row: dict[str, str], column: str) -> str | None:
    value = (row.get(column) or "").strip()
    return value or None


def _date(row: dict[str, str], column: str) -> date | None:
    value = _text(row, column)
    return date.fromisoformat(value) if value else None


def _float(row: dict[str, str], column: str) -> float | None:
    value = _text(row, column)
    return float(value) if value else None


def _int(row: dict[str, str], column: str) -> int | None:
    value = _float(row, column)
    return int(value) if value is not None else None


def read_raw_projects(path: str | Path) -> list[dict[str, object]]:
    """Validate and map CSV columns without importing training outcomes."""
    csv_path = Path(path)
    if not csv_path.is_file():
        raise FileNotFoundError(f"Project CSV not found: {csv_path}")
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    mapped = []
    for line_number, row in enumerate(rows, start=2):
        code = _text(row, "Project ID")
        name = _text(row, "Project Name")
        raw_type = (_text(row, "Project Type") or "other").lower()
        raw_stage = (_text(row, "Current Stage") or "notification").lower()
        if not code or not name:
            raise ValueError(f"CSV row {line_number}: Project ID and Project Name are required")
        if raw_type not in PROJECT_TYPES:
            raise ValueError(f"CSV row {line_number}: unsupported Project Type '{raw_type}'")
        if raw_stage not in dict(STAGES):
            raise ValueError(f"CSV row {line_number}: unsupported Current Stage '{raw_stage}'")

        sanctioned = _float(row, "Compensation Sanctioned")
        disbursed = _float(row, "Compensation Disbursed")
        affected = _int(row, "Affected Families")
        rehab = _float(row, "R&R Progress %")
        open_disputes = _int(row, "Open Disputes") or 0
        notification = _date(row, "Notification Date")
        expected = _date(row, "Expected Completion")
        if sanctioned is not None and sanctioned < 0 or disbursed is not None and disbursed < 0:
            raise ValueError(f"CSV row {line_number}: compensation amounts cannot be negative")
        if sanctioned is not None and disbursed is not None and disbursed > sanctioned:
            raise ValueError(f"CSV row {line_number}: disbursed compensation exceeds sanctioned")
        if rehab is not None and not 0 <= rehab <= 100:
            raise ValueError(f"CSV row {line_number}: R&R Progress % must be between 0 and 100")
        if open_disputes < 0 or affected is not None and affected < 0:
            raise ValueError(f"CSV row {line_number}: counts cannot be negative")
        if notification and expected and expected < notification:
            raise ValueError(f"CSV row {line_number}: Expected Completion precedes Notification Date")

        state_str = (_text(row, "State") or "").lower()
        district_str = (_text(row, "District") or "").lower()
        state_code = STATE_CODES.get(state_str, (_text(row, "State") or "")[:3].upper())

        lat = _float(row, "Latitude")
        lon = _float(row, "Longitude")
        if (lat is None or lon is None) and district_str:
            coords = (
                DISTRICT_COORDINATES.get((district_str, state_str))
                or DISTRICT_COORDINATES.get((district_str, state_code.lower()))
            )
            if coords:
                lat, lon = coords

        mapped.append({
            "project_code": code,
            "name": name,
            "project_type": PROJECT_TYPES[raw_type],
            "executing_agency": _text(row, "Implementing Agency"),
            "state_code": state_code,
            "district_codes": [_text(row, "District")] if _text(row, "District") else [],
            "total_area_ha": _float(row, "Land Area (ha)"),
            "total_affected_families": affected,
            "notification_3a_date": notification,
            "planned_start_date": notification,
            "planned_end_date": expected,
            "estimated_compensation_inr": sanctioned,
            "disbursed_compensation_inr": disbursed,
            "legal_case_count": open_disputes,
            "legal_case_status": "OPEN" if open_disputes else "NONE",
            "rehabilitation_progress_pct": rehab,
            "families_rehabilitated": round((affected or 0) * (rehab or 0) / 100),
            "current_stage": raw_stage,
            "latitude": lat,
            "longitude": lon,
        })
    return mapped


async def sync_projects_from_csv(
    session: AsyncSession, path: str | Path, *, exclusive: bool = True
) -> list[UUID]:
    """Idempotently upsert raw CSV projects and their derived stage history."""
    records = read_raw_projects(path)
    imported_ids: list[UUID] = []
    imported_codes = {str(item["project_code"]) for item in records}

    for item in records:
        result = await session.execute(
            select(Project).options(selectinload(Project.stages)).where(
                Project.project_code == item["project_code"]
            )
        )
        project = result.scalar_one_or_none()
        existing_stages = {} if project is None else {
            stage.stage_name: stage for stage in project.stages
        }
        values = {key: value for key, value in item.items() if key != "current_stage"}
        values.update({
            "acquisition_act": AcquisitionAct.RFCTLARR_2013,
            "status": ProjectStatus.ACTIVE,
            "milestone_data_status": SOURCE_MARKER,
            # These raw facts are not columns in my_raw_projects.csv. Clear
            # values left by older demo rows instead of silently mixing sources.
            "area_acquired_ha": None,
            "area_in_possession_ha": None,
            "families_compensated": None,
            "deleted_at": None,
        })
        if project is None:
            project = Project(**values, risk_level=RiskLevel.UNKNOWN)
            session.add(project)
            await session.flush()
        else:
            for key, value in values.items():
                setattr(project, key, value)

        current_index = [name for name, _ in STAGES].index(str(item["current_stage"]))
        for index, (_, stage_name) in enumerate(STAGES):
            status = StageStatus.PENDING
            if index < current_index:
                status = StageStatus.COMPLETED
            elif index == current_index:
                status = StageStatus.COMPLETED if item["current_stage"] == "completed" else StageStatus.IN_PROGRESS
            stage = existing_stages.get(stage_name)
            if stage is None:
                stage = ProjectStage(project_id=project.id, stage_name=stage_name, stage_order=index + 1)
                session.add(stage)
            stage.status = status
        imported_ids.append(project.id)

    if exclusive:
        await session.execute(
            update(Project).where(
                Project.project_code.not_in(imported_codes),
                Project.deleted_at.is_(None),
            ).values(deleted_at=datetime.now(timezone.utc))
        )
    await session.flush()
    return imported_ids


def append_or_update_project_in_csv(
    project: Project,
    prediction: dict[str, Any] | None = None,
    path: str | Path | None = None,
) -> Path:
    """Synchronize a created or updated project row directly into my_raw_projects.csv."""
    if path is None:
        from app.config import get_settings
        path = get_settings().PROJECT_DATA_CSV

    csv_path = Path(path)
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, str]] = []
    fieldnames = RAW_CSV_FIELDNAMES

    if csv_path.is_file():
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames:
                fieldnames = reader.fieldnames
            rows = list(reader)

    # Determine Project Type string
    pt = project.project_type
    raw_type = TYPE_TO_RAW.get(pt)
    if not raw_type and hasattr(pt, "value"):
        raw_type = TYPE_TO_RAW.get(pt.value, str(pt.value).lower())
    if not raw_type:
        raw_type = str(pt).lower() if pt else "other"
    if raw_type not in PROJECT_TYPES:
        raw_type = "other"

    # State
    state_code = (project.state_code or "").upper()
    state_name = CODE_TO_STATE.get(state_code, project.state_code or "")

    # District
    district = project.district_codes[0] if project.district_codes else ""

    # Dates
    notif_date = project.notification_3a_date or project.planned_start_date
    notif_str = notif_date.isoformat()[:10] if notif_date else ""
    expected_str = project.planned_end_date.isoformat()[:10] if project.planned_end_date else ""
    actual_str = getattr(project, "actual_end_date", None)
    actual_str = actual_str.isoformat()[:10] if actual_str else ""

    # Current Stage
    current_stage = "notification"
    stages_list = list(getattr(project, "stages", []) or [])
    if stages_list:
        from app.services.ml_feature_service import _current_stage
        current_stage = _current_stage(stages_list)

    # Delay predictions
    delayed_yn = ""
    delay_days = ""
    if prediction:
        prob = prediction.get("delay_probability")
        pred_days = prediction.get("predicted_delay_days")
        if prob is not None:
            delayed_yn = "Y" if (float(prob) >= 0.5 or (pred_days and float(pred_days) > 30)) else "N"
        if pred_days is not None:
            delay_days = str(max(0, round(float(pred_days))))

    new_row: dict[str, str] = {
        "Project ID": str(project.project_code),
        "Project Name": str(project.name),
        "Project Type": raw_type,
        "Implementing Agency": str(project.executing_agency or project.nodal_agency or "NHAI"),
        "State": state_name,
        "District": district,
        "Land Area (ha)": f"{float(project.total_area_ha):.1f}" if project.total_area_ha is not None else "",
        "Affected Families": str(int(project.total_affected_families)) if project.total_affected_families is not None else "",
        "Notification Date": notif_str,
        "Expected Completion": expected_str,
        "Actual Completion": actual_str,
        "Current Stage": current_stage,
        "Delayed (Y/N)": delayed_yn,
        "Delay (days)": delay_days,
        "Compensation Sanctioned": str(int(project.estimated_compensation_inr)) if project.estimated_compensation_inr is not None else "",
        "Compensation Disbursed": str(int(project.disbursed_compensation_inr)) if project.disbursed_compensation_inr is not None else "",
        "Open Disputes": str(int(project.legal_case_count or 0)),
        "R&R Progress %": str(round(float(project.rehabilitation_progress_pct))) if project.rehabilitation_progress_pct is not None else "",
        "Latitude": f"{float(project.latitude):.4f}" if project.latitude is not None else "",
        "Longitude": f"{float(project.longitude):.4f}" if project.longitude is not None else "",
    }

    # Upsert by Project ID
    found_idx = None
    for idx, r in enumerate(rows):
        if (r.get("Project ID") or "").strip() == str(project.project_code).strip():
            found_idx = idx
            break

    if found_idx is not None:
        rows[found_idx] = new_row
    else:
        rows.append(new_row)

    # Write back to CSV cleanly
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    return csv_path

