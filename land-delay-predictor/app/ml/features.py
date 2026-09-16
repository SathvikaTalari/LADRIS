"""
Feature engineering off the canonical schema. Deliberately reads only from
`app.db.schema` tables — never staging — so features are identical regardless
of whether a project's data arrived via API, DB, CSV, or manual upload.

Produces one row per project with the parameters called out in the PS: project
type, land area, affected families, compensation status, approval timelines,
legal disputes, possession status, rehabilitation progress, stakeholder
responsiveness, and historical (district/agency) performance.

Also produces a long-format stage-feature table (one row per project per
lifecycle stage) for stage-specific risk scoring.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.db.schema import (
    CompensationRecord,
    LegalDispute,
    LifecycleStage,
    Project,
    ProjectSnapshot,
    RehabilitationRecord,
    StageEvent,
    StakeholderUpdate,
)

NOW = lambda: datetime.utcnow()  # noqa: E731

# Expected max duration (in days) for each stage before it is considered overdue.
# Real values would come from historical analysis or government procedural timelines.
STAGE_EXPECTED_DAYS = {
    LifecycleStage.NOTIFICATION: 30,
    LifecycleStage.SURVEY: 60,
    LifecycleStage.APPROVAL: 90,
    LifecycleStage.COMPENSATION: 120,
    LifecycleStage.LEGAL_RESOLUTION: 180,
    LifecycleStage.REHABILITATION: 120,
    LifecycleStage.POSSESSION: 30,
    LifecycleStage.COMPLETED: 0,
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _days_between(a, b) -> float | None:
    if a is None or b is None:
        return None
    return (b - a).days


def _historical_rate(
    snapshots: list[ProjectSnapshot],
    projects: list[Project],
    key: str,
    snapshot_date: datetime,
) -> dict:
    """
    Fraction of completed projects with a known delay, grouped by `key`.

    Only projects whose actual_completion_date < snapshot_date are included,
    preventing data leakage from future information.
    """
    groups: dict[str, list[bool]] = {}
    for s in snapshots:
        if s.delayed_target is None:
            continue
        # Only include snapshots that were taken after the project was completed,
        # i.e. the outcome was known at snapshot_time.
        # We use the project's actual_completion_date to determine if the label
        # was available at the time of this snapshot.
        p = next((pr for pr in projects if pr.id == s.project_id), None)
        if p is None or p.actual_completion_date is None:
            continue
        # Only count projects completed BEFORE the snapshot_date to avoid leakage
        if p.actual_completion_date >= s.snapshot_date:
            continue
        group_key = getattr(s, key)
        if group_key is None:
            continue
        groups.setdefault(group_key, []).append(bool(s.delayed_target))
    return {k: (sum(v) / len(v)) for k, v in groups.items() if v}


def _recent_update_count(updates: list[StakeholderUpdate], days: int) -> int:
    cutoff = NOW() - pd.Timedelta(days=days)
    return sum(1 for u in updates if u.update_date >= cutoff)


def _avg_days_between_updates(updates: list[StakeholderUpdate]) -> float | None:
    if len(updates) < 2:
        return None
    dates = sorted(u.update_date for u in updates)
    gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
    return sum(gaps) / len(gaps)


# ── Per-project feature table ────────────────────────────────────────────────

def build_feature_table(session: Session) -> pd.DataFrame:
    """One row per project with all predictive parameters from the PS."""
    projects = session.query(Project).all()
    snapshots = session.query(ProjectSnapshot).all()
    district_delay_rate = _historical_rate(
        snapshots, projects, key="district", snapshot_date=NOW()
    )
    agency_delay_rate = _historical_rate(
        snapshots, projects, key="implementing_agency", snapshot_date=NOW()
    )

    rows = []
    for p in projects:
        comp = p.compensation_records[-1] if p.compensation_records else None
        disputes = p.legal_disputes
        rehab = p.rehabilitation
        updates = p.stakeholder_updates
        stage_events = p.stage_events
        open_disputes = [d for d in disputes if d.resolved_date is None]

        row = _project_base_features(p)
        row.update({
            "compensation_sanctioned": comp.amount_sanctioned if comp else None,
            "compensation_disbursed": comp.amount_disbursed if comp else None,
            "compensation_disbursement_pct": comp.disbursement_pct if comp else None,
            "days_since_last_disbursement": (
                _days_between(comp.last_disbursement_date, NOW()) if comp and comp.last_disbursement_date else None
            ),
            "legal_dispute_count": len(disputes),
            "open_legal_dispute_count": len(open_disputes),
            "max_dispute_pendency_days": max(
                [_days_between(d.filed_date, NOW()) or 0 for d in open_disputes], default=0
            ),
            "rehabilitation_progress_pct": rehab.progress_pct if rehab else None,
            "resettlement_site_ready": rehab.resettlement_site_ready if rehab else None,
            "stakeholder_update_count_90d": _recent_update_count(updates, days=90),
            "avg_days_between_updates": _avg_days_between_updates(updates),
            "stage_count_recorded": len(stage_events),
            "current_stage": p.current_stage,
            "district_historical_delay_rate": district_delay_rate.get(p.district),
            "agency_historical_delay_rate": agency_delay_rate.get(p.implementing_agency),
            "delayed_target": 1 if p.is_delayed else 0 if p.is_delayed is not None else None,
            "delay_days": p.delay_days,
        })
        rows.append(row)

    return pd.DataFrame(rows)


def build_snapshot_feature_table(
    session: Session,
    snapshot_date: datetime | None = None,
) -> pd.DataFrame:
    """
    Build a time-aware feature table from project snapshots.

    Each row represents one project's state at a specific snapshot_date.
    Features reflect only information available on that date, and
    delayed_target represents the later real outcome (0/1).
    """
    if snapshot_date is None:
        snapshot_date = NOW()

    projects = session.query(Project).all()
    snapshots = session.query(ProjectSnapshot).all()

    district_delay_rate = _historical_rate(
        snapshots, projects, key="district", snapshot_date=snapshot_date
    )
    agency_delay_rate = _historical_rate(
        snapshots, projects, key="implementing_agency", snapshot_date=snapshot_date
    )

    rows = []
    for s in snapshots:
        if s.snapshot_date > snapshot_date:
            continue  # Skip future snapshots

        p = next((pr for pr in projects if pr.id == s.project_id), None)
        if p is None:
            continue

        comp = p.compensation_records[-1] if p.compensation_records else None
        disputes = p.legal_disputes
        rehab = p.rehabilitation
        updates = p.stakeholder_updates
        stage_events = p.stage_events

        # Only count records that existed before the snapshot date
        open_disputes = [
            d for d in disputes
            if d.filed_date is not None and d.filed_date <= s.snapshot_date
            and d.resolved_date is None
        ]

        row = {
            "project_id": p.id,
            "project_type": s.project_type,
            "state": s.state,
            "district": s.district,
            "implementing_agency": s.implementing_agency,
            "land_area_hectares": s.land_area_hectares,
            "affected_families_count": s.affected_families_count,
            "days_since_notification": s.days_since_notification,
            "days_to_expected_completion": s.days_to_expected_completion,
            "compensation_sanctioned": s.compensation_sanctioned,
            "compensation_disbursed": s.compensation_disbursed,
            "compensation_disbursement_pct": s.compensation_disbursement_pct,
            "days_since_last_disbursement": s.days_since_last_disbursement,
            "legal_dispute_count": s.legal_dispute_count,
            "open_legal_dispute_count": s.open_legal_dispute_count,
            "max_dispute_pendency_days": s.max_dispute_pendency_days,
            "rehabilitation_progress_pct": s.rehabilitation_progress_pct,
            "resettlement_site_ready": s.resettlement_site_ready,
            "stakeholder_update_count_90d": s.stakeholder_update_count_90d,
            "avg_days_between_updates": s.avg_days_between_updates,
            "stage_count_recorded": s.stage_count_recorded,
            "current_stage": s.current_stage,
            "district_historical_delay_rate": s.district_historical_delay_rate,
            "agency_historical_delay_rate": s.agency_historical_delay_rate,
            "snapshot_date": s.snapshot_date,
            "delayed_target": s.delayed_target,
            "delay_days": s.delay_days,
        }
        rows.append(row)

    return pd.DataFrame(rows)


def build_snapshot_features_from_projects(
    session: Session,
    projects: list[Project],
    snapshot_dates: list[datetime],
) -> list[dict]:
    """
    Generate time-aware snapshots for each project at multiple dates.

    For each project and snapshot_date, compute features that reflect only
    information available on that date.
    """
    snapshots = []
    for p in projects:
        for snapshot_date in snapshot_dates:
            if p.notification_date and snapshot_date < p.notification_date:
                continue  # Skip dates before project notification

            comp = p.compensation_records[-1] if p.compensation_records else None
            disputes = p.legal_disputes
            rehab = p.rehabilitation
            updates = p.stakeholder_updates
            stage_events = p.stage_events

            # Only count records that existed before the snapshot date
            open_disputes = [
                d for d in disputes
                if d.filed_date is not None and d.filed_date <= snapshot_date
                and d.resolved_date is None
            ]

            row = {
                "project_id": p.id,
                "snapshot_date": snapshot_date,
                "delayed_target": 1 if p.is_delayed else 0,
                "project_type": p.project_type,
                "state": p.state,
                "district": p.district,
                "implementing_agency": p.implementing_agency,
                "land_area_hectares": p.land_area_hectares,
                "affected_families_count": p.affected_families_count,
                "days_since_notification": _days_between(p.notification_date, snapshot_date),
                "days_to_expected_completion": _days_between(snapshot_date, p.expected_completion_date),
                "compensation_sanctioned": comp.amount_sanctioned if comp else None,
                "compensation_disbursed": comp.amount_disbursed if comp else None,
                "compensation_disbursement_pct": comp.disbursement_pct if comp else None,
                "days_since_last_disbursement": (
                    _days_between(comp.last_disbursement_date, snapshot_date)
                    if comp and comp.last_disbursement_date else None
                ),
                "legal_dispute_count": len(disputes),
                "open_legal_dispute_count": len(open_disputes),
                "max_dispute_pendency_days": max(
                    [_days_between(d.filed_date, snapshot_date) or 0 for d in open_disputes], default=0
                ),
                "rehabilitation_progress_pct": rehab.progress_pct if rehab else None,
                "resettlement_site_ready": rehab.resettlement_site_ready if rehab else None,
                "stakeholder_update_count_90d": _recent_update_count(updates, days=90),
                "avg_days_between_updates": _avg_days_between_updates(updates),
                "stage_count_recorded": len(stage_events),
                "current_stage": p.current_stage,
            }
            snapshots.append(row)

    return snapshots


def _project_base_features(p: Project) -> dict:
    return {
        "project_id": p.id,
        "project_type": p.project_type,
        "state": p.state,
        "district": p.district,
        "implementing_agency": p.implementing_agency,
        "land_area_hectares": p.land_area_hectares,
        "affected_families_count": p.affected_families_count,
        "days_since_notification": _days_between(p.notification_date, NOW()),
        "days_to_expected_completion": _days_between(NOW(), p.expected_completion_date),
    }


# ── Stage-level feature table (long format) ──────────────────────────────────

def build_stage_features(session: Session) -> pd.DataFrame:
    """One row per (project, lifecycle stage) for stage-specific risk scoring."""
    projects = session.query(Project).all()
    snapshots = session.query(ProjectSnapshot).all()
    district_delay_rate = _historical_rate(
        snapshots, projects, key="district", snapshot_date=NOW()
    )
    agency_delay_rate = _historical_rate(
        snapshots, projects, key="implementing_agency", snapshot_date=NOW()
    )

    rows = []
    for p in projects:
        stage_events = p.stage_events
        project_row = _project_base_features(p)
        # Merge in enriched features
        comp = p.compensation_records[-1] if p.compensation_records else None
        disputes = p.legal_disputes
        rehab = p.rehabilitation
        updates = p.stakeholder_updates
        open_disputes = [d for d in disputes if d.resolved_date is None]
        project_row.update({
            "compensation_sanctioned": comp.amount_sanctioned if comp else None,
            "compensation_disbursed": comp.amount_disbursed if comp else None,
            "compensation_disbursement_pct": comp.disbursement_pct if comp else None,
            "days_since_last_disbursement": (
                _days_between(comp.last_disbursement_date, NOW()) if comp and comp.last_disbursement_date else None
            ),
            "legal_dispute_count": len(disputes),
            "open_legal_dispute_count": len(open_disputes),
            "max_dispute_pendency_days": max(
                [_days_between(d.filed_date, NOW()) or 0 for d in open_disputes], default=0
            ),
            "rehabilitation_progress_pct": rehab.progress_pct if rehab else None,
            "resettlement_site_ready": rehab.resettlement_site_ready if rehab else None,
            "stakeholder_update_count_90d": _recent_update_count(updates, days=90),
            "avg_days_between_updates": _avg_days_between_updates(updates),
            "stage_count_recorded": len(stage_events),
            "district_historical_delay_rate": district_delay_rate.get(p.district),
            "agency_historical_delay_rate": agency_delay_rate.get(p.implementing_agency),
            "delayed_target": 1 if p.is_delayed else 0 if p.is_delayed is not None else None,
            "delay_days": p.delay_days,
        })

        for stage in LifecycleStage:
            stage_event = next((se for se in stage_events if se.stage == stage), None)
            if stage_event is not None:
                tenure = (stage_event.exited_at or NOW() - stage_event.entered_at).days
                overdue = is_stage_overdue(stage, stage_event.entered_at, stage_event.exited_at)
                overdue_days = stage_overdue_days(stage, stage_event.entered_at, stage_event.exited_at)
            else:
                tenure = None
                overdue = False
                overdue_days = 0

            row = dict(project_row)
            row.update({
                "stage": stage.value,
                "is_current_stage": stage == p.current_stage,
                "stage_tenure_days": tenure,
                "stage_overdue": overdue,
                "stage_overdue_days": overdue_days,
                "expected_completion_date": p.expected_completion_date,
            })
            rows.append(row)

    return pd.DataFrame(rows)


def is_stage_overdue(stage: LifecycleStage, entered_at: datetime,
                     exited_at: Optional[datetime] = None) -> bool:
    expected = STAGE_EXPECTED_DAYS.get(stage, 90)
    end = exited_at or NOW()
    if entered_at is None:
        return False
    elapsed = (end - entered_at).days
    return elapsed > expected


def stage_overdue_days(stage: LifecycleStage, entered_at: Optional[datetime],
                       exited_at: Optional[datetime] = None) -> int:
    if entered_at is None:
        return 0
    expected = STAGE_EXPECTED_DAYS.get(stage, 90)
    end = exited_at or NOW()
    elapsed = (end - entered_at).days
    return max(0, elapsed - expected)


def compute_stage_tenure_days(event: Optional[StageEvent]) -> Optional[int]:
    if event is None or event.entered_at is None:
        return None
    end = event.exited_at or NOW()
    return (end - event.entered_at).days
