"""Central PostgreSQL -> production ML feature mapping.

All calculations are point-in-time and outcome fields are only consulted when
building historical priors from projects completed before the snapshot.
"""
from __future__ import annotations

from datetime import date, datetime, timezone, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project import Project, ProjectStatus
from app.models.stage import ProjectStage, StageName, StageStatus
from app.models.ml_source import CompensationRecord, LegalCaseRecord, RehabilitationRecord, StakeholderUpdate

PROJECT_TYPE_MAP = {
    "HIGHWAY": "highway", "RAILWAY": "railway", "METRO_RAIL": "railway",
    "AIRPORT": "other", "PORT": "other", "POWER_TRANSMISSION": "power",
    "PIPELINE": "pipeline", "IRRIGATION": "irrigation",
    "URBAN_DEVELOPMENT": "urban", "INDUSTRIAL_CORRIDOR": "industrial",
    "DEFENCE": "defence", "OTHER": "other",
}

STATE_MAP = {
    "AP": "Andhra Pradesh", "AR": "Arunachal Pradesh", "AS": "Assam", "BR": "Bihar",
    "CG": "Chhattisgarh", "GA": "Goa", "GJ": "Gujarat", "HR": "Haryana",
    "HP": "Himachal Pradesh", "JH": "Jharkhand", "KA": "Karnataka", "KL": "Kerala",
    "MP": "Madhya Pradesh", "MH": "Maharashtra", "MN": "Manipur", "ML": "Meghalaya",
    "MZ": "Mizoram", "NL": "Nagaland", "OD": "Odisha", "PB": "Punjab", "RJ": "Rajasthan",
    "SK": "Sikkim", "TN": "Tamil Nadu", "TS": "Telangana", "TR": "Tripura",
    "UP": "Uttar Pradesh", "UK": "Uttarakhand", "WB": "West Bengal", "DL": "Delhi",
    "JK": "Jammu and Kashmir", "LA": "Ladakh", "PY": "Puducherry",
}

STAGE_MAP = {
    "PRELIMINARY_NOTIFICATION": "notification",
    "SOCIAL_IMPACT_ASSESSMENT": "survey",
    "EXPERT_GROUP_REVIEW": "approval",
    "SECTION_19_DECLARATION": "approval",
    "SECTION_21_OBJECTIONS": "legal_resolution",
    "AWARD_PREPARATION": "compensation",
    "AWARD_ANNOUNCEMENT": "compensation",
    "COMPENSATION_DISBURSEMENT": "compensation",
    "REHABILITATION_RESETTLEMENT": "rehabilitation",
    "POSSESSION": "possession", "MUTATION": "possession",
    "PROJECT_HANDOVER": "completed",
}


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    return value.date() if isinstance(value, datetime) else value


def _days(start: Any, end: Any) -> int | None:
    start, end = _as_date(start), _as_date(end)
    return None if start is None or end is None else (end - start).days


def _value(value: Any) -> Any:
    return value.value if hasattr(value, "value") else value


def _current_stage(stages: list[ProjectStage]) -> str:
    active = [s for s in stages if s.status in (StageStatus.IN_PROGRESS, StageStatus.DELAYED, StageStatus.BLOCKED)]
    relevant = active or [s for s in stages if s.status == StageStatus.COMPLETED]
    if not relevant:
        return "notification"
    chosen = max(relevant, key=lambda s: s.stage_order)
    return STAGE_MAP.get(str(_value(chosen.stage_name)), "notification")


def _historical_rate(projects: list[Project], snapshot: date, field: str, key: str) -> float | None:
    outcomes = []
    for item in projects:
        actual_end = _as_date(item.actual_end_date)
        planned_end = _as_date(item.planned_end_date)
        if actual_end is None or planned_end is None or actual_end >= snapshot:
            continue
        value = getattr(item, field)
        if field == "district_codes":
            value = (value or [None])[0]
        if value == key:
            outcomes.append(actual_end > planned_end)
    return sum(outcomes) / len(outcomes) if outcomes else None


async def load_project_context(db: AsyncSession, project_id) -> tuple[Project | None, list[Project]]:
    result = await db.execute(select(Project).options(selectinload(Project.stages)).where(Project.id == project_id, Project.deleted_at.is_(None)))
    project = result.scalar_one_or_none()
    all_result = await db.execute(select(Project).where(Project.deleted_at.is_(None)))
    if project is not None:
        project._ml_compensation_records = list((await db.execute(select(CompensationRecord).where(CompensationRecord.project_id == project_id))).scalars().all())
        project._ml_legal_cases = list((await db.execute(select(LegalCaseRecord).where(LegalCaseRecord.project_id == project_id))).scalars().all())
        project._ml_rehabilitation_records = list((await db.execute(select(RehabilitationRecord).where(RehabilitationRecord.project_id == project_id))).scalars().all())
        project._ml_stakeholder_updates = list((await db.execute(select(StakeholderUpdate).where(StakeholderUpdate.project_id == project_id))).scalars().all())
    return project, list(all_result.scalars().all())


def build_features(project: Project, population: list[Project], snapshot_date: datetime) -> tuple[dict[str, Any], list[str]]:
    """Return exactly the 23 ordered model fields plus unavailable-source notes."""
    snapshot = _as_date(snapshot_date)
    notification = project.notification_3a_date or project.planned_start_date
    compensation_records = [record for record in getattr(project, "_ml_compensation_records", []) if _as_date(record.created_at) <= snapshot]
    legal_records = [record for record in getattr(project, "_ml_legal_cases", []) if _as_date(record.created_at) <= snapshot]
    rehabilitation_records = [record for record in getattr(project, "_ml_rehabilitation_records", []) if _as_date(record.updated_at) <= snapshot]
    stakeholder_updates = [record for record in getattr(project, "_ml_stakeholder_updates", []) if _as_date(record.update_date) <= snapshot]
    sanctioned = sum(float(record.awarded_amount_inr or 0) for record in compensation_records) if compensation_records else (float(project.estimated_compensation_inr) if project.estimated_compensation_inr is not None else None)
    disbursed = sum(float(record.disbursed_amount_inr or 0) for record in compensation_records if record.disbursement_date is None or record.disbursement_date <= snapshot) if compensation_records else (float(project.disbursed_compensation_inr) if project.disbursed_compensation_inr is not None else None)
    pct = (disbursed / sanctioned * 100.0) if sanctioned not in (None, 0) and disbursed is not None else None
    stages = [s for s in list(project.stages or []) if s.status != StageStatus.PENDING and (not s.actual_start_date or _as_date(s.actual_start_date) <= snapshot)]
    district = (project.district_codes or [None])[0]
    agency = project.executing_agency or project.nodal_agency
    if legal_records:
        legal_total = len(legal_records)
        open_records = [record for record in legal_records if record.resolution_date is None or record.resolution_date > snapshot]
        legal_open = len(open_records)
        max_pendency = max((_days(record.filing_date, snapshot) or 0 for record in open_records), default=0)
    else:
        legal_total = project.legal_case_count
        legal_open = legal_total if str(project.legal_case_status or "").upper() not in {"NONE", "RESOLVED", "CLOSED"} else 0
        max_pendency = None
    rehab = getattr(project, "rehabilitation_progress_pct", None)
    rehab = float(rehab) if rehab is not None else None
    resettlement_ready = None
    if rehabilitation_records:
        latest_rehab = max(rehabilitation_records, key=lambda record: record.updated_at)
        if latest_rehab.total_families_to_rehabilitate:
            rehab = float(latest_rehab.families_relocated or 0) / float(latest_rehab.total_families_to_rehabilitate) * 100
        resettlement_ready = latest_rehab.resettlement_site_ready
    if rehab is None and project.total_affected_families:
        rehab = float(project.families_rehabilitated or 0) / float(project.total_affected_families) * 100.0

    unavailable = []
    if legal_total and legal_open and not legal_records:
        unavailable.append("max_dispute_pendency_days: no dispute filed dates stored")
    disbursement_dates = [record.disbursement_date for record in compensation_records if record.disbursement_date and record.disbursement_date <= snapshot]
    days_since_disbursement = _days(max(disbursement_dates), snapshot) if disbursement_dates else None
    if not disbursement_dates: unavailable.append("days_since_last_disbursement: no disbursement event dates stored")
    if not stakeholder_updates: unavailable.append("stakeholder update statistics: no stakeholder update events stored")
    update_dates = sorted(_as_date(record.update_date) for record in stakeholder_updates)
    update_gaps = [(update_dates[index + 1] - update_dates[index]).days for index in range(len(update_dates) - 1)]

    features = {
        "project_type": PROJECT_TYPE_MAP.get(str(_value(project.project_type)), "other"),
        "state": STATE_MAP.get(project.state_code, project.state_code),
        "district": district,
        "implementing_agency": agency,
        "land_area_hectares": float(project.total_area_ha) if project.total_area_ha is not None else None,
        "affected_families_count": project.total_affected_families,
        "days_since_notification": _days(notification, snapshot),
        "days_to_expected_completion": _days(snapshot, project.planned_end_date),
        "compensation_sanctioned": sanctioned,
        "compensation_disbursed": disbursed,
        "compensation_disbursement_pct": pct,
        "days_since_last_disbursement": days_since_disbursement,
        "legal_dispute_count": legal_total,
        "open_legal_dispute_count": legal_open,
        "max_dispute_pendency_days": max_pendency,
        "rehabilitation_progress_pct": rehab,
        "resettlement_site_ready": resettlement_ready,
        "stakeholder_update_count_90d": sum(update_date >= snapshot - timedelta(days=90) for update_date in update_dates) if stakeholder_updates else None,
        "avg_days_between_updates": sum(update_gaps) / len(update_gaps) if update_gaps else None,
        "stage_count_recorded": len(stages),
        "current_stage": _current_stage(stages),
        "district_historical_delay_rate": _historical_rate(population, snapshot, "district_codes", district),
        "agency_historical_delay_rate": _historical_rate(population, snapshot, "executing_agency", agency),
    }
    return features, unavailable


def validate_project_consistency(project: Project) -> list[str]:
    errors = []
    area_acquired = getattr(project, "area_acquired_ha", None)
    area_possessed = getattr(project, "area_in_possession_ha", None)
    if project.total_area_ha is not None and area_acquired is not None and area_acquired > project.total_area_ha:
        errors.append("acquired area cannot exceed total area")
    if area_acquired is not None and area_possessed is not None and area_possessed > area_acquired:
        errors.append("possession area cannot exceed acquired area")
    if project.estimated_compensation_inr is not None and project.disbursed_compensation_inr is not None and project.disbursed_compensation_inr > project.estimated_compensation_inr:
        errors.append("disbursed compensation cannot exceed sanctioned compensation")
    if project.families_compensated and project.total_affected_families is not None and project.families_compensated > project.total_affected_families:
        errors.append("compensated families cannot exceed affected families")
    if project.families_rehabilitated and project.total_affected_families is not None and project.families_rehabilitated > project.total_affected_families:
        errors.append("rehabilitated families cannot exceed affected families")
    if project.planned_start_date and project.planned_end_date and project.planned_end_date < project.planned_start_date:
        errors.append("planned end date cannot precede planned start date")
    if project.notification_3a_date and project.notification_3d_date and project.notification_3d_date < project.notification_3a_date:
        errors.append("3D notification date cannot precede 3A notification date")
    return errors
