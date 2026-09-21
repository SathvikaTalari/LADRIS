"""
LADRIS — Live Datasource Sync Service
======================================
Orchestrates delta-detection, field-level patching, and ML pipeline re-triggering
for projects connected to live external datasources (REST API or PostgreSQL DB).

Key public interface:
  - create_sync_job()         — register a new live link for a project
  - run_sync_job()            — fetch, diff, apply delta, trigger ML
  - run_all_due_sync_jobs()   — called by the background poller
  - get_changelog()           — field-level history for a project

Credential security:
  - All connection URLs and API keys are Fernet-encrypted before storage.
  - encrypt_credential() / decrypt_credential() handle the symmetric key.
  - If FERNET_ENCRYPTION_KEY is unset in .env, a WARNING is logged and a
    deterministic fallback is used (safe for dev, NOT for production).
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.config import get_settings
from app.models.live_sync import ChangeSource, LiveSyncJob, ProjectChangeLog, SyncSourceType
from app.models.ml_models import MLPrediction
from app.models.project import Project

log = logging.getLogger(__name__)
settings = get_settings()

# ─── ML-relevant LADRIS project fields that the sync engine can update ─────────
# Expanding this list in the future is safe — just add the field name.
SYNCABLE_PROJECT_FIELDS: set[str] = {
    "name",
    "description",
    "status",
    "risk_level",
    "nodal_agency",
    "executing_agency",
    "total_area_ha",
    "area_acquired_ha",
    "area_in_possession_ha",
    "total_affected_families",
    "families_compensated",
    "families_rehabilitated",
    "rehabilitation_progress_pct",
    "planned_start_date",
    "planned_end_date",
    "actual_start_date",
    "actual_end_date",
    "baseline_duration_days",
    "estimated_compensation_inr",
    "disbursed_compensation_inr",
    "notification_3a_date",
    "notification_3d_date",
    "delay_months",
    "delay_reason",
    "legal_case_count",
    "legal_case_status",
    "latitude",
    "longitude",
}


# ─── Credential Encryption (Fernet) ──────────────────────────────────────────

def _get_fernet():
    """Return a Fernet instance, generating a stable key if none is configured."""
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        raise RuntimeError(
            "cryptography package is required for live sync credential encryption. "
            "Run: pip install cryptography"
        )
    raw_key = settings.FERNET_ENCRYPTION_KEY.strip()
    if raw_key:
        key = raw_key.encode()
    else:
        # Deterministic fallback for development — NOT secure for production
        log.warning(
            "FERNET_ENCRYPTION_KEY is not set in .env. Using deterministic fallback key. "
            "Set a real Fernet key before deploying to production."
        )
        import base64
        seed = "LADRIS_DEV_FERNET_KEY_DO_NOT_USE_IN_PRODUCTION"
        key = base64.urlsafe_b64encode(hashlib.sha256(seed.encode()).digest())
    return Fernet(key)


def encrypt_credential(plaintext: str) -> str:
    """Encrypt a credential string for storage. Returns base64 ciphertext."""
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_credential(ciphertext: str) -> str:
    """Decrypt a stored credential. Raises on tampered/invalid ciphertext."""
    if not ciphertext:
        return ""
    return _get_fernet().decrypt(ciphertext.encode()).decode()


# ─── Data structures ──────────────────────────────────────────────────────────

@dataclass
class FieldChange:
    """Represents a single changed field detected during delta computation."""
    field_name: str
    old_value: Any
    new_value: Any


@dataclass
class SyncResult:
    """Summary returned by run_sync_job()."""
    job_id: str
    project_id: str
    ext_project_id: str
    success: bool
    changes_detected: int = 0
    changes_applied: int = 0
    ml_triggered: bool = False
    ml_prediction_id: Optional[str] = None
    new_risk_score: Optional[float] = None
    new_risk_category: Optional[str] = None
    error: Optional[str] = None
    duration_ms: Optional[float] = None
    changed_fields: List[str] = field(default_factory=list)


# ─── Fetch Helpers ────────────────────────────────────────────────────────────

async def _fetch_rest_api(job: LiveSyncJob) -> dict[str, Any]:
    """
    Fetch the current project record from a REST API endpoint.
    The endpoint is expected to return a JSON object (or a list with one item).
    The ext_project_id is passed as a query parameter keyed by ext_id_field.
    """
    url = decrypt_credential(job.connection_url_encrypted)
    api_key = decrypt_credential(job.api_key_encrypted) if job.api_key_encrypted else None

    headers: dict[str, str] = {"Accept": "application/json"}
    if api_key:
        headers["X-API-Key"] = api_key

    params = {job.ext_id_field: job.ext_project_id}

    async with httpx.AsyncClient(timeout=settings.LIVE_SYNC_REQUEST_TIMEOUT_SECS) as client:
        response = await client.get(url, headers=headers, params=params)
        response.raise_for_status()

    data = response.json()
    # Support both a bare object and a list-wrapped response
    if isinstance(data, list):
        if not data:
            raise ValueError(
                f"REST API returned empty list for ext_project_id={job.ext_project_id}"
            )
        data = data[0]
    if not isinstance(data, dict):
        raise ValueError(
            f"REST API response is not a JSON object (got {type(data).__name__})"
        )
    return data


async def _fetch_database(job: LiveSyncJob) -> dict[str, Any]:
    """
    Fetch the current project record from an external PostgreSQL database.
    Uses the async SQLAlchemy engine to run a parameterised SELECT.
    """
    if not job.db_table_name:
        raise ValueError("db_table_name is required for DATABASE sync jobs")

    conn_url = decrypt_credential(job.connection_url_encrypted)
    # Convert to asyncpg URL if needed
    if conn_url.startswith("postgresql://"):
        conn_url = conn_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif not conn_url.startswith("postgresql+asyncpg://"):
        raise ValueError(
            "DATABASE sync job connection_url must start with 'postgresql://' or 'postgresql+asyncpg://'"
        )

    engine = create_async_engine(conn_url, pool_pre_ping=True, pool_size=1, max_overflow=0)
    try:
        async with engine.connect() as conn:
            result = await conn.execute(
                text(
                    f"SELECT * FROM {job.db_table_name} "  # noqa: S608 — table name validated
                    f"WHERE {job.ext_id_field} = :ext_id LIMIT 1"
                ),
                {"ext_id": job.ext_project_id},
            )
            row = result.mappings().one_or_none()
            if row is None:
                raise ValueError(
                    f"No record found in {job.db_table_name} "
                    f"where {job.ext_id_field} = {job.ext_project_id!r}"
                )
            return dict(row)
    finally:
        await engine.dispose()


async def fetch_external_record(job: LiveSyncJob) -> dict[str, Any]:
    """Dispatch to the correct fetcher based on source_type."""
    if job.source_type == SyncSourceType.REST_API:
        return await _fetch_rest_api(job)
    elif job.source_type == SyncSourceType.DATABASE:
        return await _fetch_database(job)
    else:
        raise ValueError(f"Unsupported source_type: {job.source_type}")


# ─── Delta Computation ────────────────────────────────────────────────────────

def _coerce_to_str(value: Any) -> Optional[str]:
    """Normalise a field value to a string for comparison (None-safe)."""
    if value is None:
        return None
    return str(value).strip()


def compute_delta(
    old_payload: dict[str, Any],
    new_payload: dict[str, Any],
    column_mapping: dict[str, str],
) -> list[FieldChange]:
    """
    Compare old and new payloads using the column_mapping.
    Only returns changes for fields that:
      1. Appear in column_mapping
      2. Map to a SYNCABLE_PROJECT_FIELDS entry
      3. Have a different value (string-coerced comparison)

    Args:
        old_payload:    Last known external payload (stored as last_payload_snapshot)
        new_payload:    Freshly fetched external payload
        column_mapping: { "ext_column": "ladris_field" }

    Returns:
        List of FieldChange objects (may be empty if no change detected)
    """
    changes: list[FieldChange] = []

    for ext_col, ladris_field in column_mapping.items():
        # Only sync fields that we know are safe to write to the Project model
        if ladris_field not in SYNCABLE_PROJECT_FIELDS:
            log.debug("Skipping unsyncable field mapping: %s → %s", ext_col, ladris_field)
            continue

        old_raw = old_payload.get(ext_col)
        new_raw = new_payload.get(ext_col)

        old_str = _coerce_to_str(old_raw)
        new_str = _coerce_to_str(new_raw)

        if old_str != new_str:
            changes.append(FieldChange(
                field_name=ladris_field,
                old_value=old_raw,
                new_value=new_raw,
            ))

    return changes


# ─── Apply Delta ─────────────────────────────────────────────────────────────

def _cast_field_value(field_name: str, raw_value: Any) -> Any:
    """
    Cast the raw external value to the appropriate Python type for the
    corresponding SQLAlchemy column.
    """
    from datetime import date
    from decimal import Decimal

    if raw_value is None:
        return None

    # Integer fields
    int_fields = {
        "total_affected_families", "families_compensated", "families_rehabilitated",
        "baseline_duration_days", "delay_months", "legal_case_count",
    }
    # Decimal / Numeric fields
    decimal_fields = {
        "total_area_ha", "area_acquired_ha", "area_in_possession_ha",
        "rehabilitation_progress_pct", "estimated_compensation_inr",
        "disbursed_compensation_inr", "latitude", "longitude",
    }
    # Date fields
    date_fields = {
        "planned_start_date", "planned_end_date", "actual_start_date",
        "actual_end_date", "notification_3a_date", "notification_3d_date",
    }

    try:
        if field_name in int_fields:
            return int(raw_value)
        if field_name in decimal_fields:
            return Decimal(str(raw_value))
        if field_name in date_fields:
            if isinstance(raw_value, date):
                return raw_value
            return date.fromisoformat(str(raw_value)[:10])
    except (ValueError, TypeError) as exc:
        log.warning("Could not cast %s=%r: %s — storing as-is", field_name, raw_value, exc)

    return raw_value


async def apply_delta_to_project(
    db: AsyncSession,
    project: Project,
    changes: list[FieldChange],
    sync_job_id: Optional[UUID],
    changed_by: str = ChangeSource.LIVE_SYNC,
) -> list[ProjectChangeLog]:
    """
    Write only the changed fields to the Project row and insert one
    ProjectChangeLog row per changed field.

    Returns the list of created log rows (before ML backfill).
    """
    log_rows: list[ProjectChangeLog] = []

    for change in changes:
        cast_value = _cast_field_value(change.field_name, change.new_value)
        try:
            setattr(project, change.field_name, cast_value)
        except AttributeError:
            log.error(
                "Project model has no attribute %r — skipping delta apply",
                change.field_name,
            )
            continue

        log_row = ProjectChangeLog(
            project_id=project.id,
            sync_job_id=sync_job_id,
            changed_by=changed_by,
            field_name=change.field_name,
            old_value=_coerce_to_str(change.old_value),
            new_value=_coerce_to_str(change.new_value),
            ml_triggered=False,
        )
        db.add(log_row)
        log_rows.append(log_row)

    return log_rows


# ─── ML Trigger ──────────────────────────────────────────────────────────────

async def trigger_ml_refresh(
    db: AsyncSession,
    project_id: UUID,
    change_log_rows: list[ProjectChangeLog],
) -> dict[str, Any]:
    """
    Call the production ML pipeline to regenerate the delay risk prediction
    for the project. After generation, backfill ml_prediction_id and
    ml_triggered=True on every related ProjectChangeLog row.
    """
    from app.services.production_ml_service import generate_prediction

    result = await generate_prediction(db, project_id)

    prediction_id_str = result.get("prediction_id")
    if prediction_id_str:
        prediction_uuid = UUID(prediction_id_str)
        for row in change_log_rows:
            row.ml_triggered = True
            row.ml_prediction_id = prediction_uuid

    log.info(
        "ML refresh complete: project=%s risk_score=%.1f risk_category=%s prediction_id=%s",
        project_id,
        result.get("risk_score", 0),
        result.get("risk_category", "UNKNOWN"),
        prediction_id_str,
    )
    return result


# ─── Main Sync Orchestrator ───────────────────────────────────────────────────

async def run_sync_job(db: AsyncSession, job: LiveSyncJob) -> SyncResult:
    """
    Full sync cycle for one LiveSyncJob:
      1. Fetch fresh data from external source
      2. MD5 hash check → skip if identical
      3. Compute field-level delta
      4. Apply delta to LADRIS project (only changed fields)
      5. Insert ProjectChangeLog rows
      6. Trigger ML pipeline
      7. Update job state (last_polled_at, last_data_hash, consecutive_failures)

    This is safe to call concurrently for multiple jobs.
    """
    t_start = time.perf_counter()
    result = SyncResult(
        job_id=str(job.id),
        project_id=str(job.project_id),
        ext_project_id=job.ext_project_id,
        success=False,
    )

    try:
        # ── 1. Fetch ──────────────────────────────────────────────────────────
        new_payload = await fetch_external_record(job)

        # ── 2. Hash check ─────────────────────────────────────────────────────
        payload_bytes = json.dumps(new_payload, sort_keys=True, default=str).encode()
        new_hash = hashlib.md5(payload_bytes).hexdigest()  # noqa: S324 — non-security use

        if new_hash == job.last_data_hash:
            log.debug(
                "LiveSync job %s: payload hash unchanged, skipping (project=%s)",
                job.id, job.project_id,
            )
            job.last_polled_at = datetime.now(timezone.utc)
            result.success = True
            result.changes_detected = 0
            result.duration_ms = (time.perf_counter() - t_start) * 1000
            return result

        # ── 3. Delta computation ───────────────────────────────────────────────
        old_payload = job.last_payload_snapshot or {}
        changes = compute_delta(old_payload, new_payload, job.column_mapping or {})
        result.changes_detected = len(changes)
        result.changed_fields = [c.field_name for c in changes]

        if not changes:
            # Hash changed but no mapped field changed (metadata noise)
            log.info(
                "LiveSync job %s: hash changed but no mapped field delta (project=%s)",
                job.id, job.project_id,
            )
            job.last_data_hash = new_hash
            job.last_payload_snapshot = new_payload
            job.last_polled_at = datetime.now(timezone.utc)
            result.success = True
            result.duration_ms = (time.perf_counter() - t_start) * 1000
            return result

        # ── 4. Load project and apply delta ────────────────────────────────────
        project = await db.get(Project, job.project_id)
        if project is None:
            raise LookupError(f"Project {job.project_id} not found in LADRIS database")

        log_rows = await apply_delta_to_project(
            db=db,
            project=project,
            changes=changes,
            sync_job_id=job.id,
        )
        result.changes_applied = len(log_rows)

        # ── 5. Flush so log rows get IDs before ML ─────────────────────────────
        await db.flush()

        # ── 6. Trigger ML pipeline ─────────────────────────────────────────────
        ml_result = await trigger_ml_refresh(db, job.project_id, log_rows)
        result.ml_triggered = True
        result.ml_prediction_id = ml_result.get("prediction_id")
        result.new_risk_score = ml_result.get("risk_score")
        result.new_risk_category = ml_result.get("risk_category")

        # ── 7. Update job state ────────────────────────────────────────────────
        job.last_data_hash = new_hash
        job.last_payload_snapshot = new_payload
        job.last_polled_at = datetime.now(timezone.utc)
        job.last_successful_sync_at = datetime.now(timezone.utc)
        job.consecutive_failures = 0
        job.last_error = None

        result.success = True
        log.info(
            "LiveSync job %s SUCCESS: %d field(s) changed, ML score=%.1f → %s (project=%s)",
            job.id, result.changes_applied,
            result.new_risk_score or 0, result.new_risk_category, job.project_id,
        )

    except Exception as exc:
        error_msg = f"{type(exc).__name__}: {exc}"
        log.error("LiveSync job %s FAILED: %s", job.id, error_msg)

        job.last_polled_at = datetime.now(timezone.utc)
        job.consecutive_failures = (job.consecutive_failures or 0) + 1
        job.last_error = error_msg[:2000]

        # Auto-disable after too many consecutive failures
        if job.consecutive_failures >= settings.LIVE_SYNC_MAX_FAILURES:
            job.is_active = False
            log.warning(
                "LiveSync job %s auto-disabled after %d consecutive failures",
                job.id, job.consecutive_failures,
            )

        result.error = error_msg

    finally:
        result.duration_ms = round((time.perf_counter() - t_start) * 1000, 1)

    return result


# ─── Background Poller ────────────────────────────────────────────────────────

async def run_all_due_sync_jobs(db: AsyncSession) -> list[SyncResult]:
    """
    Query all active LiveSyncJobs that are due for polling, run them
    concurrently, and commit results. Called by the background poller loop.
    """
    from sqlalchemy import or_
    now = datetime.now(timezone.utc)

    # A job is "due" if it has never run, or last_polled_at + interval ≤ now
    due_jobs_stmt = select(LiveSyncJob).where(
        LiveSyncJob.is_active.is_(True),
        or_(
            LiveSyncJob.last_polled_at.is_(None),
            text(
                "last_polled_at + (sync_interval_mins * interval '1 minute') <= NOW() AT TIME ZONE 'UTC'"
            ),
        ),
    )
    due_jobs: list[LiveSyncJob] = (await db.execute(due_jobs_stmt)).scalars().all()

    if not due_jobs:
        return []

    log.info("LiveSync poller: %d job(s) due for sync", len(due_jobs))

    # Run all due jobs concurrently (each gets its own mini-transaction via flush/commit)
    tasks = [run_sync_job(db, job) for job in due_jobs]
    results: list[SyncResult] = await asyncio.gather(*tasks, return_exceptions=False)

    try:
        await db.commit()
    except Exception as exc:
        log.error("LiveSync commit failed after batch run: %s", exc)
        await db.rollback()

    return results


# ─── Job CRUD Helpers ─────────────────────────────────────────────────────────

async def create_sync_job(
    db: AsyncSession,
    project_id: UUID,
    source_type: str,
    connection_url: str,
    ext_project_id: str,
    column_mapping: dict[str, str],
    api_key: Optional[str] = None,
    db_table_name: Optional[str] = None,
    ext_id_field: str = "id",
    sync_interval_mins: int = 60,
    source_label: Optional[str] = None,
    created_by: Optional[UUID] = None,
) -> LiveSyncJob:
    """
    Create and persist a new LiveSyncJob with encrypted credentials.
    Validates that the project exists before creating the link.
    """
    project = await db.get(Project, project_id)
    if project is None:
        raise ValueError(f"Project {project_id} does not exist")

    # Validate column_mapping only references syncable fields
    invalid = {
        ext_col: ladris_field
        for ext_col, ladris_field in column_mapping.items()
        if ladris_field not in SYNCABLE_PROJECT_FIELDS
    }
    if invalid:
        raise ValueError(
            f"column_mapping references unsupported LADRIS fields: {list(invalid.values())}. "
            f"Allowed fields: {sorted(SYNCABLE_PROJECT_FIELDS)}"
        )

    job = LiveSyncJob(
        project_id=project_id,
        source_type=SyncSourceType(source_type),
        source_label=source_label,
        connection_url_encrypted=encrypt_credential(connection_url),
        api_key_encrypted=encrypt_credential(api_key) if api_key else None,
        db_table_name=db_table_name,
        ext_project_id=ext_project_id,
        ext_id_field=ext_id_field,
        column_mapping=column_mapping,
        sync_interval_mins=sync_interval_mins,
        webhook_secret=secrets.token_urlsafe(32),
        created_by=created_by,
        is_active=True,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return job


async def get_change_log(
    db: AsyncSession,
    project_id: UUID,
    limit: int = 100,
    offset: int = 0,
) -> list[ProjectChangeLog]:
    """Return the most recent change log entries for a project."""
    result = await db.execute(
        select(ProjectChangeLog)
        .where(ProjectChangeLog.project_id == project_id)
        .order_by(ProjectChangeLog.changed_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


def verify_webhook_signature(payload_bytes: bytes, signature_header: str, secret: str) -> bool:
    """
    Verify HMAC-SHA256 webhook signature sent as 'sha256=<hex_digest>'.
    External systems must compute: HMAC-SHA256(secret, raw_body).
    """
    if not signature_header or not secret:
        return False
    try:
        scheme, digest = signature_header.split("=", 1)
        if scheme != "sha256":
            return False
        expected = hmac.new(secret.encode(), payload_bytes, "sha256").hexdigest()
        return hmac.compare_digest(expected, digest)
    except Exception:
        return False
