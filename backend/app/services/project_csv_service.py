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

STATE_CODES = {
    "andhra pradesh": "AP", "assam": "AS", "bihar": "BR", "chhattisgarh": "CG",
    "delhi": "DL", "gujarat": "GJ", "haryana": "HR", "karnataka": "KA",
    "kerala": "KL", "madhya pradesh": "MP", "maharashtra": "MH", "odisha": "OD",
    "punjab": "PB", "rajasthan": "RJ", "tamil nadu": "TN", "telangana": "TS",
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

        mapped.append({
            "project_code": code,
            "name": name,
            "project_type": PROJECT_TYPES[raw_type],
            "executing_agency": _text(row, "Implementing Agency"),
            "state_code": STATE_CODES.get((_text(row, "State") or "").lower(), (_text(row, "State") or "")[:3].upper()),
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
                Project.milestone_data_status == "SYNTHETIC_DEMO",
                Project.deleted_at.is_(None),
            ).values(deleted_at=datetime.now(timezone.utc))
        )
    await session.flush()
    return imported_ids
