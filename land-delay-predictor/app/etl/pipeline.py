"""
Promotes staged raw records into the canonical schema. This is where all
"what does this source's field actually mean" logic lives, driven by each
source's field-mapping config (config/sources/*.yaml -> `field_mapping` key).

Design choices:
  - Idempotent: dedupes on (source_id, external_project_id) via the unique
    constraint on Project, so re-running against already-promoted staging
    rows is safe.
  - Child records (compensation, rehab, legal, stage events) are UPSERTED,
    not blindly appended, so re-running ETL doesn't create duplicate rows.
  - Rejects (doesn't raise) on missing required fields, logging the reason on
    the RawRecord so a human can fix the source mapping rather than the whole
    batch failing silently.
  - Webhook-sourced records flagged _pending_verification are skipped until
    cleared (see webhook_connector.py).

v2 fixes:
  - Idempotent child records: CompensationRecord and RehabilitationRecord
    are now UPSERTED (delete+replace) on each ETL run, not appended.
  - current_stage: coerced to LifecycleStage enum values safely — invalid
    strings are stored as None rather than crashing.
  - delay_days: negative values (data entry errors) are clamped to 0.
  - LegalDispute: skipped if count == 0 but existing disputes are not deleted.
"""
from __future__ import annotations

import json
from datetime import datetime

import pandas as pd

from dateutil import parser as date_parser
from sqlalchemy.orm import Session

from app.db.schema import (
    CompensationRecord,
    IngestionSource,
    LegalDispute,
    LifecycleStage,
    Project,
    ProjectSnapshot,
    RehabilitationRecord,
    StageEvent,
)
from app.db.staging import RawRecord
from app.ingestion.base import load_source_config

REQUIRED_FIELDS = ["external_project_id", "project_name", "project_type", "state", "district"]

# Map common alternative spellings/abbreviations found in CSV exports
STAGE_ALIASES: dict[str, str] = {
    "notif": "notification",
    "notify": "notification",
    "surv": "survey",
    "approv": "approval",
    "comp": "compensation",
    "compensate": "compensation",
    "legal": "legal_resolution",
    "dispute": "legal_resolution",
    "rehab": "rehabilitation",
    "r&r": "rehabilitation",
    "possess": "possession",
    "posses": "possession",
    "complete": "completed",
    "done": "completed",
    "finished": "completed",
}

_VALID_STAGES = {s.value for s in LifecycleStage}


def _coerce_stage(value) -> LifecycleStage | None:
    """Safely parse a stage string → LifecycleStage enum, or None if unrecognized."""
    if value is None:
        return None
    raw = str(value).strip().lower().replace(" ", "_").replace("-", "_")
    if raw in _VALID_STAGES:
        return LifecycleStage(raw)
    alias = STAGE_ALIASES.get(raw)
    if alias and alias in _VALID_STAGES:
        return LifecycleStage(alias)
    return None  # unrecognized — do not crash the ETL run


def _map_fields(raw: dict, mapping: dict) -> dict:
    """Translate source field names to canonical field names using the config's
    field_mapping (canonical_name -> source_name)."""
    mapped = {}
    for canonical_name, source_name in mapping.items():
        if source_name in raw:
            mapped[canonical_name] = raw[source_name]
    return mapped


TRUTHY = {"y", "yes", "true", "1", "delayed"}
FALSY = {"n", "no", "false", "0", "not delayed"}


def _parse_bool(value):
    """Sources represent booleans inconsistently (Y/N, true/false, 1/0, blank
    for unknown). Normalize to Python bool or None (unknown/not yet resolved)."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in TRUTHY:
        return True
    if text in FALSY:
        return False
    return None  # unrecognized/blank - treat as unknown rather than guessing


def _parse_date(value):
    if value in (None, "", "NaT", "nan", "None"):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return date_parser.parse(str(value))
    except Exception:
        return None


def _safe_int(value):
    try:
        if value is None or str(value).strip() in ("", "nan", "None"):
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _safe_float(value):
    try:
        if value is None or str(value).strip() in ("", "nan", "None"):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_pct(numerator, denominator):
    try:
        if numerator is None or not denominator:
            return None
        return round(float(numerator) / float(denominator) * 100, 2)
    except (TypeError, ZeroDivisionError, ValueError):
        return None


def _snapshot_feature_values(project: Project, now: datetime) -> dict:
    """Compute the 23 feature values for a project snapshot."""
    comp = project.compensation_records[-1] if project.compensation_records else None
    disputes = project.legal_disputes
    rehab = project.rehabilitation
    updates = project.stakeholder_updates
    stage_events = project.stage_events
    open_disputes = [d for d in disputes if d.resolved_date is None]

    def days_between(a, b) -> int | None:
        if a is None or b is None:
            return None
        return (b - a).days

    stakeholder_updates_90d = sum(
        1 for u in updates if u.update_date >= now - pd.Timedelta(days=90)
    )
    avg_days_between_updates = None
    if len(updates) >= 2:
        dates = sorted(u.update_date for u in updates)
        gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
        avg_days_between_updates = sum(gaps) / len(gaps)

    return {
        "project_id": project.id,
        "project_type": project.project_type,
        "state": project.state,
        "district": project.district,
        "implementing_agency": project.implementing_agency,
        "land_area_hectares": project.land_area_hectares,
        "affected_families_count": project.affected_families_count,
        "days_since_notification": days_between(project.notification_date, now),
        "days_to_expected_completion": days_between(now, project.expected_completion_date),
        "compensation_sanctioned": comp.amount_sanctioned if comp else None,
        "compensation_disbursed": comp.amount_disbursed if comp else None,
        "compensation_disbursement_pct": comp.disbursement_pct if comp else None,
        "days_since_last_disbursement": (
            days_between(comp.last_disbursement_date, now)
            if comp and comp.last_disbursement_date else None
        ),
        "legal_dispute_count": len(disputes),
        "open_legal_dispute_count": len(open_disputes),
        "max_dispute_pendency_days": max(
            [days_between(d.filed_date, now) or 0 for d in open_disputes], default=0
        ),
        "rehabilitation_progress_pct": rehab.progress_pct if rehab else None,
        "resettlement_site_ready": rehab.resettlement_site_ready if rehab else None,
        "stakeholder_update_count_90d": stakeholder_updates_90d,
        "avg_days_between_updates": avg_days_between_updates,
        "stage_count_recorded": len(stage_events),
        "current_stage": project.current_stage,
        "delayed_target": 1 if project.is_delayed else 0 if project.is_delayed is not None else None,
    }


def promote_source_records(session: Session, source_id: str, config_path: str | None) -> dict:
    """Process all un-promoted staging rows for one source. Returns summary counts."""
    mapping = {}
    if config_path:
        try:
            config = load_source_config(config_path)
            mapping = config.get("field_mapping", {})
        except Exception:
            pass  # no config or unreadable — fall through to identity mapping

    raw_rows = (
        session.query(RawRecord)
        .filter_by(source_id=source_id, promoted=False)
        .all()
    )

    promoted, rejected = 0, 0

    for raw_row in raw_rows:
        try:
            payload = json.loads(raw_row.payload_json)
        except json.JSONDecodeError:
            raw_row.rejection_reason = "invalid JSON payload"
            rejected += 1
            continue

        if payload.get("_pending_verification"):
            continue  # webhook source not yet cleared for promotion

        mapped = _map_fields(payload, mapping) if mapping else payload

        missing = [f for f in REQUIRED_FIELDS if not mapped.get(f)]
        if missing:
            raw_row.rejection_reason = f"missing required fields: {missing}"
            rejected += 1
            continue

        existing = (
            session.query(Project)
            .filter_by(source_id=source_id, external_project_id=str(mapped["external_project_id"]))
            .first()
        )
        project = existing or Project(
            source_id=source_id,
            external_project_id=str(mapped["external_project_id"]),
        )

        project.project_name = str(mapped.get("project_name", "")).strip() or project.project_name
        project.project_type = str(mapped.get("project_type", "")).strip().lower() or project.project_type
        project.implementing_agency = mapped.get("implementing_agency") or project.implementing_agency
        project.state = str(mapped.get("state", "")).strip() or project.state
        project.district = str(mapped.get("district", "")).strip() or project.district
        project.land_area_hectares = _safe_float(mapped.get("land_area_hectares")) or project.land_area_hectares
        project.affected_families_count = _safe_int(mapped.get("affected_families_count")) or project.affected_families_count
        project.notification_date = _parse_date(mapped.get("notification_date")) or project.notification_date
        project.expected_completion_date = _parse_date(mapped.get("expected_completion_date")) or project.expected_completion_date
        project.actual_completion_date = _parse_date(mapped.get("actual_completion_date")) or project.actual_completion_date

        # ── Stage: coerce safely ──────────────────────────────────────────────
        stage_val = _coerce_stage(mapped.get("current_stage"))
        if stage_val is not None:
            project.current_stage = stage_val

        # ── Labels ────────────────────────────────────────────────────────────
        is_delayed = _parse_bool(mapped.get("is_delayed"))
        if is_delayed is not None:
            project.is_delayed = is_delayed

        delay_days_raw = _safe_int(mapped.get("delay_days"))
        if delay_days_raw is not None:
            project.delay_days = max(0, delay_days_raw)  # clamp negatives

        project.updated_at = datetime.utcnow()

        if not existing:
            session.add(project)
        session.flush()  # get project.id before attaching children

        # ── Create time-aware snapshot ───────────────────────────────────────────────
        # Create a snapshot of the project state as of today for time-aware training.
        # The same project may have multiple snapshots over time, allowing the model
        # to learn how delay risk changes.
        now = datetime.utcnow()

        # Find existing snapshot for this date
        snapshot = session.query(ProjectSnapshot).filter_by(
            project_id=project.id,
            snapshot_date=now,
        ).first()

        # Create new snapshot if not found
        if snapshot is None:
            snapshot = ProjectSnapshot(project_id=project.id, snapshot_date=now)
            session.add(snapshot)
        else:
            # Update existing snapshot
            snapshot.project_id = project.id
            snapshot.snapshot_date = now

        # Update snapshot with essential fields for ML (all 23 feature columns + project_id + snapshot_date + delayed_target)
        snapshot.delayed_target = (
            1 if project.is_delayed else 0 if project.is_delayed is not None else None
        )
        snapshot.delay_days = project.delay_days
        snapshot.actual_completion_date = project.actual_completion_date
        snapshot.project_type = project.project_type
        snapshot.state = project.state
        snapshot.district = project.district
        snapshot.implementing_agency = project.implementing_agency
        snapshot.land_area_hectares = project.land_area_hectares
        snapshot.affected_families_count = project.affected_families_count

        # Calculate temporal features
        snapshot.days_since_notification = (
            (now - project.notification_date).days
            if project.notification_date else None
        )
        snapshot.days_to_expected_completion = (
            (project.expected_completion_date - now).days
            if project.expected_completion_date else None
        )

        # Handle compensation
        comp = project.compensation_records[-1] if project.compensation_records else None
        snapshot.compensation_sanctioned = comp.amount_sanctioned if comp else None
        snapshot.compensation_disbursed = comp.amount_disbursed if comp else None
        snapshot.compensation_disbursement_pct = comp.disbursement_pct if comp else None
        snapshot.last_disbursement_date = comp.last_disbursement_date if comp else None

        # Handle legal disputes
        disputes = project.legal_disputes
        snapshot.legal_dispute_count = len(disputes)
        open_disputes = [d for d in disputes if d.resolved_date is None]
        snapshot.open_legal_dispute_count = len(open_disputes)
        snapshot.max_dispute_pendency_days = max(
            [((d.filed_date - now).days or 0) for d in open_disputes if d.filed_date is not None], default=0
        )

        # Handle rehabilitation
        rehab = project.rehabilitation
        snapshot.rehabilitation_progress_pct = rehab.progress_pct if rehab else None
        snapshot.resettlement_site_ready = rehab.resettlement_site_ready if rehab else None

        # Handle stakeholder updates
        updates = project.stakeholder_updates
        snapshot.stakeholder_update_count_90d = sum(
            1 for u in updates if u.update_date >= now - pd.Timedelta(days=90)
        )

        # Calculate average days between updates
        if len(updates) >= 2:
            dates = sorted(u.update_date for u in updates)
            gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
            snapshot.avg_days_between_updates = sum(gaps) / len(gaps)
        else:
            snapshot.avg_days_between_updates = None

        # Add other derived features
        snapshot.stage_count_recorded = len(project.stage_events)
        snapshot.current_stage = project.current_stage

        # ── Compensation (UPSERT: replace existing record) ────────────────────
        comp_sanctioned = _safe_float(mapped.get("compensation_sanctioned"))
        comp_disbursed = _safe_float(mapped.get("compensation_disbursed"))
        if comp_sanctioned is not None or comp_disbursed is not None:
            existing_comp = (
                session.query(CompensationRecord)
                .filter_by(project_id=project.id)
                .first()
            )
            if existing_comp:
                # Update in-place (idempotent)
                if comp_sanctioned is not None:
                    existing_comp.amount_sanctioned = comp_sanctioned
                if comp_disbursed is not None:
                    existing_comp.amount_disbursed = comp_disbursed
                    existing_comp.disbursement_pct = _safe_pct(comp_disbursed, comp_sanctioned or existing_comp.amount_sanctioned)
                existing_comp.sanction_date = _parse_date(mapped.get("compensation_sanction_date")) or existing_comp.sanction_date
                existing_comp.last_disbursement_date = _parse_date(mapped.get("last_disbursement_date")) or existing_comp.last_disbursement_date
            else:
                session.add(CompensationRecord(
                    project_id=project.id,
                    amount_sanctioned=comp_sanctioned,
                    amount_disbursed=comp_disbursed,
                    disbursement_pct=_safe_pct(comp_disbursed, comp_sanctioned),
                    sanction_date=_parse_date(mapped.get("compensation_sanction_date")),
                    last_disbursement_date=_parse_date(mapped.get("last_disbursement_date")),
                ))

        # ── Legal disputes ────────────────────────────────────────────────────
        dispute_count = _safe_int(mapped.get("legal_dispute_count"))
        if dispute_count and dispute_count > 0:
            existing_disputes = (
                session.query(LegalDispute)
                .filter_by(project_id=project.id)
                .count()
            )
            if existing_disputes == 0:  # only insert if none recorded yet
                session.add(LegalDispute(
                    project_id=project.id,
                    dispute_type=mapped.get("dispute_type"),
                    filed_date=_parse_date(mapped.get("dispute_filed_date")),
                    resolved_date=_parse_date(mapped.get("dispute_resolved_date")),
                    court_level=mapped.get("court_level"),
                ))

        # ── Rehabilitation (UPSERT) ───────────────────────────────────────────
        rehab_pct = _safe_float(mapped.get("rehabilitation_progress_pct"))
        if rehab_pct is not None:
            existing_rehab = (
                session.query(RehabilitationRecord)
                .filter_by(project_id=project.id)
                .first()
            )
            if existing_rehab:
                existing_rehab.progress_pct = rehab_pct
                families_to = _safe_int(mapped.get("families_to_resettle"))
                families_done = _safe_int(mapped.get("families_resettled"))
                if families_to is not None:
                    existing_rehab.families_to_resettle = families_to
                if families_done is not None:
                    existing_rehab.families_resettled = families_done
                site_ready = _parse_bool(mapped.get("resettlement_site_ready"))
                if site_ready is not None:
                    existing_rehab.resettlement_site_ready = site_ready
            else:
                session.add(RehabilitationRecord(
                    project_id=project.id,
                    families_to_resettle=_safe_int(mapped.get("families_to_resettle")),
                    families_resettled=_safe_int(mapped.get("families_resettled")),
                    resettlement_site_ready=_parse_bool(mapped.get("resettlement_site_ready")),
                    progress_pct=rehab_pct,
                ))

        # ── Stage event ───────────────────────────────────────────────────────
        if stage_val and mapped.get("stage_entered_date"):
            entered = _parse_date(mapped.get("stage_entered_date"))
            if entered:
                existing_stage_event = (
                    session.query(StageEvent)
                    .filter_by(project_id=project.id, stage=stage_val)
                    .first()
                )
                if not existing_stage_event:
                    session.add(StageEvent(
                        project_id=project.id,
                        stage=stage_val,
                        entered_at=entered,
                        exited_at=_parse_date(mapped.get("stage_exited_date")),
                    ))

        raw_row.promoted = True
        raw_row.promoted_at = datetime.utcnow()
        promoted += 1

    session.commit()
    return {"promoted": promoted, "rejected": rejected, "total": len(raw_rows)}


def promote_all_sources(session: Session) -> dict:
    summary = {}
    for source in session.query(IngestionSource).filter_by(is_active=True).all():
        summary[source.name] = promote_source_records(session, source.id, source.config_path)
    return summary
