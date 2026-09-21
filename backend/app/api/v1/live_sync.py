"""
LADRIS — API v1: Live Datasource Sync Engine
=============================================
REST endpoints for managing live external datasource links,
viewing the field-level change log, and receiving webhooks.

Endpoints:
  POST   /api/v1/live-sync/jobs                          — create sync job
  GET    /api/v1/live-sync/jobs                          — list all jobs
  GET    /api/v1/live-sync/jobs/{job_id}                 — get job details
  PATCH  /api/v1/live-sync/jobs/{job_id}                 — update job config
  DELETE /api/v1/live-sync/jobs/{job_id}                 — remove job
  POST   /api/v1/live-sync/jobs/{job_id}/trigger         — force immediate sync
  GET    /api/v1/live-sync/changelog/{project_id}        — field-level change history
  GET    /api/v1/live-sync/changelog/{project_id}/summary — change count summary
  POST   /api/v1/live-sync/webhook/{project_id}          — receive webhook push

RBAC: All endpoints require authenticated user.
      Webhook endpoint additionally validates HMAC-SHA256 signature.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.live_sync import LiveSyncJob, ProjectChangeLog, SyncSourceType
from app.models.user import User
from app.services.audit_service import record_audit_log
from app.services.live_sync_service import (
    SYNCABLE_PROJECT_FIELDS,
    compute_delta,
    create_sync_job,
    decrypt_credential,
    get_change_log,
    run_sync_job,
    verify_webhook_signature,
)

router = APIRouter(prefix="/live-sync", tags=["Live Datasource Sync"])


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class CreateSyncJobRequest(BaseModel):
    project_id: UUID
    source_type: str = Field(..., description="'REST_API' or 'DATABASE'")
    source_label: Optional[str] = Field(None, description="Human-readable name for this datasource")
    connection_url: str = Field(
        ...,
        description=(
            "For REST_API: the base endpoint URL (e.g. https://bhoomirashi.gov.in/api/project). "
            "For DATABASE: postgresql://user:pass@host:port/db"
        ),
    )
    api_key: Optional[str] = Field(None, description="API key for REST_API sources (stored encrypted)")
    db_table_name: Optional[str] = Field(None, description="Table/view name for DATABASE sources")
    ext_project_id: str = Field(
        ..., description="The project identifier used in the external system"
    )
    ext_id_field: str = Field(
        "id", description="Column name in the external record that holds ext_project_id"
    )
    column_mapping: Dict[str, str] = Field(
        ...,
        description=(
            "Maps external column names → LADRIS canonical field names. "
            "Example: {\"land_acquired_ha\": \"area_acquired_ha\", \"case_count\": \"legal_case_count\"}"
        ),
    )
    sync_interval_mins: int = Field(60, ge=1, le=1440, description="Polling interval in minutes (1–1440)")

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, v: str) -> str:
        allowed = {t.value for t in SyncSourceType}
        if v not in allowed:
            raise ValueError(f"source_type must be one of: {allowed}")
        return v

    @field_validator("column_mapping")
    @classmethod
    def validate_mapping(cls, v: Dict[str, str]) -> Dict[str, str]:
        if not v:
            raise ValueError("column_mapping cannot be empty")
        bad = [lf for lf in v.values() if lf not in SYNCABLE_PROJECT_FIELDS]
        if bad:
            raise ValueError(
                f"Unsupported LADRIS field(s) in column_mapping: {bad}. "
                f"Allowed: {sorted(SYNCABLE_PROJECT_FIELDS)}"
            )
        return v


class UpdateSyncJobRequest(BaseModel):
    is_active: Optional[bool] = None
    sync_interval_mins: Optional[int] = Field(None, ge=1, le=1440)
    source_label: Optional[str] = None
    column_mapping: Optional[Dict[str, str]] = None

    @field_validator("column_mapping")
    @classmethod
    def validate_mapping(cls, v: Optional[Dict[str, str]]) -> Optional[Dict[str, str]]:
        if v is not None:
            bad = [lf for lf in v.values() if lf not in SYNCABLE_PROJECT_FIELDS]
            if bad:
                raise ValueError(f"Unsupported LADRIS field(s): {bad}")
        return v


class SyncJobResponse(BaseModel):
    id: str
    project_id: str
    source_type: str
    source_label: Optional[str]
    ext_project_id: str
    ext_id_field: str
    column_mapping: Dict[str, str]
    sync_interval_mins: int
    is_active: bool
    last_polled_at: Optional[str]
    last_successful_sync_at: Optional[str]
    consecutive_failures: int
    last_error: Optional[str]
    webhook_secret: Optional[str]
    created_at: str
    updated_at: str

    @classmethod
    def from_orm(cls, job: LiveSyncJob) -> "SyncJobResponse":
        return cls(
            id=str(job.id),
            project_id=str(job.project_id),
            source_type=job.source_type.value if hasattr(job.source_type, "value") else job.source_type,
            source_label=job.source_label,
            ext_project_id=job.ext_project_id,
            ext_id_field=job.ext_id_field,
            column_mapping=job.column_mapping or {},
            sync_interval_mins=job.sync_interval_mins,
            is_active=job.is_active,
            last_polled_at=job.last_polled_at.isoformat() if job.last_polled_at else None,
            last_successful_sync_at=job.last_successful_sync_at.isoformat() if job.last_successful_sync_at else None,
            consecutive_failures=job.consecutive_failures,
            last_error=job.last_error,
            webhook_secret=job.webhook_secret,
            created_at=job.created_at.isoformat(),
            updated_at=job.updated_at.isoformat(),
        )


class ChangeLogEntryResponse(BaseModel):
    id: int
    project_id: str
    sync_job_id: Optional[str]
    changed_by: str
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    ml_triggered: bool
    ml_prediction_id: Optional[str]
    changed_at: str

    @classmethod
    def from_orm(cls, row: ProjectChangeLog) -> "ChangeLogEntryResponse":
        return cls(
            id=row.id,
            project_id=str(row.project_id),
            sync_job_id=str(row.sync_job_id) if row.sync_job_id else None,
            changed_by=row.changed_by,
            field_name=row.field_name,
            old_value=row.old_value,
            new_value=row.new_value,
            ml_triggered=row.ml_triggered,
            ml_prediction_id=str(row.ml_prediction_id) if row.ml_prediction_id else None,
            changed_at=row.changed_at.isoformat(),
        )


class SyncTriggerResponse(BaseModel):
    job_id: str
    project_id: str
    ext_project_id: str
    success: bool
    changes_detected: int
    changes_applied: int
    changed_fields: List[str]
    ml_triggered: bool
    ml_prediction_id: Optional[str]
    new_risk_score: Optional[float]
    new_risk_category: Optional[str]
    error: Optional[str]
    duration_ms: Optional[float]


# ─── Endpoint: Create Sync Job ────────────────────────────────────────────────

@router.post("/jobs", response_model=SyncJobResponse, status_code=status.HTTP_201_CREATED)
async def create_live_sync_job(
    payload: CreateSyncJobRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncJobResponse:
    """
    Register a live external datasource link for a LADRIS project.

    The connection_url and api_key are encrypted with Fernet before storage.
    A webhook_secret is automatically generated — share it with the external
    system to enable push-based syncs via the webhook endpoint.
    """
    try:
        job = await create_sync_job(
            db=db,
            project_id=payload.project_id,
            source_type=payload.source_type,
            connection_url=payload.connection_url,
            ext_project_id=payload.ext_project_id,
            column_mapping=payload.column_mapping,
            api_key=payload.api_key,
            db_table_name=payload.db_table_name,
            ext_id_field=payload.ext_id_field,
            sync_interval_mins=payload.sync_interval_mins,
            source_label=payload.source_label,
            created_by=current_user.id,
        )
        await db.commit()
        await db.refresh(job)

        await record_audit_log(
            db=db,
            action="LIVE_SYNC_JOB_CREATED",
            user_id=current_user.id,
            user_email=current_user.email,
            user_role=current_user.role,
            resource_type="live_sync_job",
            resource_id=job.id,
            ip_address=request.client.host if request.client else None,
            request_method="POST",
            request_path="/api/v1/live-sync/jobs",
            response_status=201,
        )

        return SyncJobResponse.from_orm(job)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create sync job: {exc}")


# ─── Endpoint: List Sync Jobs ─────────────────────────────────────────────────

@router.get("/jobs", response_model=List[SyncJobResponse])
async def list_live_sync_jobs(
    project_id: Optional[UUID] = Query(None, description="Filter by LADRIS project UUID"),
    active_only: bool = Query(False, description="Return only active jobs"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[SyncJobResponse]:
    """List all live sync jobs, optionally filtered by project or active status."""
    stmt = select(LiveSyncJob)
    if project_id:
        stmt = stmt.where(LiveSyncJob.project_id == project_id)
    if active_only:
        stmt = stmt.where(LiveSyncJob.is_active.is_(True))
    stmt = stmt.order_by(LiveSyncJob.created_at.desc()).limit(limit)

    jobs = (await db.execute(stmt)).scalars().all()
    return [SyncJobResponse.from_orm(j) for j in jobs]


# ─── Endpoint: Get Sync Job ────────────────────────────────────────────────────

@router.get("/jobs/{job_id}", response_model=SyncJobResponse)
async def get_live_sync_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncJobResponse:
    """Get details of a specific live sync job."""
    job = await db.get(LiveSyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Sync job {job_id} not found")
    return SyncJobResponse.from_orm(job)


# ─── Endpoint: Update Sync Job ────────────────────────────────────────────────

@router.patch("/jobs/{job_id}", response_model=SyncJobResponse)
async def update_live_sync_job(
    job_id: UUID,
    payload: UpdateSyncJobRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncJobResponse:
    """Enable/disable a sync job, change its polling interval, or update its column mapping."""
    job = await db.get(LiveSyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Sync job {job_id} not found")

    if payload.is_active is not None:
        job.is_active = payload.is_active
        if payload.is_active:
            # Re-enable: reset failure counter
            job.consecutive_failures = 0
            job.last_error = None
    if payload.sync_interval_mins is not None:
        job.sync_interval_mins = payload.sync_interval_mins
    if payload.source_label is not None:
        job.source_label = payload.source_label
    if payload.column_mapping is not None:
        job.column_mapping = payload.column_mapping

    await db.commit()
    await db.refresh(job)
    return SyncJobResponse.from_orm(job)


# ─── Endpoint: Delete Sync Job ────────────────────────────────────────────────

@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_live_sync_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Remove a live sync job. Does not affect the linked LADRIS project or its data."""
    job = await db.get(LiveSyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Sync job {job_id} not found")
    await db.delete(job)
    await db.commit()


# ─── Endpoint: Force Immediate Sync ───────────────────────────────────────────

@router.post("/jobs/{job_id}/trigger", response_model=SyncTriggerResponse)
async def trigger_sync_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncTriggerResponse:
    """
    Force an immediate sync cycle for a specific job, regardless of schedule.
    Returns the full delta result including changed fields, ML score, and error info.
    """
    job = await db.get(LiveSyncJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Sync job {job_id} not found")

    try:
        result = await run_sync_job(db, job)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Manual sync trigger failed: {exc}",
        )

    return SyncTriggerResponse(
        job_id=result.job_id,
        project_id=result.project_id,
        ext_project_id=result.ext_project_id,
        success=result.success,
        changes_detected=result.changes_detected,
        changes_applied=result.changes_applied,
        changed_fields=result.changed_fields,
        ml_triggered=result.ml_triggered,
        ml_prediction_id=result.ml_prediction_id,
        new_risk_score=result.new_risk_score,
        new_risk_category=result.new_risk_category,
        error=result.error,
        duration_ms=result.duration_ms,
    )


# ─── Endpoint: Change Log ─────────────────────────────────────────────────────

@router.get("/changelog/{project_id}", response_model=List[ChangeLogEntryResponse])
async def get_project_change_log(
    project_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    field_name: Optional[str] = Query(None, description="Filter by a specific field name"),
    ml_triggered_only: bool = Query(False, description="Only return changes that triggered ML"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ChangeLogEntryResponse]:
    """
    Return the field-level change history for a project.
    Shows every delta that was detected from live syncs,
    and whether each change triggered the ML pipeline.
    """
    stmt = (
        select(ProjectChangeLog)
        .where(ProjectChangeLog.project_id == project_id)
    )
    if field_name:
        stmt = stmt.where(ProjectChangeLog.field_name == field_name)
    if ml_triggered_only:
        stmt = stmt.where(ProjectChangeLog.ml_triggered.is_(True))
    stmt = stmt.order_by(ProjectChangeLog.changed_at.desc()).limit(limit).offset(offset)

    rows = (await db.execute(stmt)).scalars().all()
    return [ChangeLogEntryResponse.from_orm(r) for r in rows]


@router.get("/changelog/{project_id}/summary")
async def get_change_log_summary(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return a summary of change activity for a project."""
    from sqlalchemy import func
    rows = (await db.execute(
        select(
            ProjectChangeLog.field_name,
            func.count(ProjectChangeLog.id).label("change_count"),
            func.max(ProjectChangeLog.changed_at).label("last_changed_at"),
            func.sum(
                ProjectChangeLog.ml_triggered.cast(
                    __import__("sqlalchemy").Integer
                )
            ).label("ml_trigger_count"),
        )
        .where(ProjectChangeLog.project_id == project_id)
        .group_by(ProjectChangeLog.field_name)
        .order_by(func.count(ProjectChangeLog.id).desc())
    )).all()

    return {
        "project_id": str(project_id),
        "field_summaries": [
            {
                "field_name": r.field_name,
                "change_count": r.change_count,
                "ml_trigger_count": r.ml_trigger_count or 0,
                "last_changed_at": r.last_changed_at.isoformat() if r.last_changed_at else None,
            }
            for r in rows
        ],
        "total_changes": sum(r.change_count for r in rows),
        "total_ml_triggers": sum((r.ml_trigger_count or 0) for r in rows),
    }


# ─── Endpoint: Webhook Receiver ───────────────────────────────────────────────

@router.post("/webhook/{project_id}", status_code=status.HTTP_200_OK)
async def receive_webhook(
    project_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    x_ladris_signature: Optional[str] = Header(None, alias="X-LADRIS-Signature"),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Receive a webhook push from an external datasource.

    The external system must send:
    - Header: X-LADRIS-Signature: sha256=<HMAC-SHA256(webhook_secret, raw_body)>
    - Body: JSON object with the updated project fields (same format as polling)

    A sync job for this project must already exist (matching job is looked up
    by project_id). The first active job with a matching webhook_secret is used.
    """
    raw_body = await request.body()

    # Find the active sync job for this project that has a webhook_secret
    stmt = (
        select(LiveSyncJob)
        .where(
            LiveSyncJob.project_id == project_id,
            LiveSyncJob.is_active.is_(True),
            LiveSyncJob.webhook_secret.isnot(None),
        )
        .limit(1)
    )
    job = (await db.execute(stmt)).scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=404,
            detail="No active live sync job with webhook support found for this project",
        )

    # Verify HMAC signature
    if not verify_webhook_signature(raw_body, x_ladris_signature or "", job.webhook_secret or ""):
        raise HTTPException(
            status_code=401,
            detail="Webhook signature verification failed. "
                   "Ensure X-LADRIS-Signature: sha256=<HMAC-SHA256(secret, body)> is correct.",
        )

    # Parse payload
    try:
        new_payload: dict = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {exc}")

    if not isinstance(new_payload, dict):
        raise HTTPException(status_code=400, detail="Webhook payload must be a JSON object")

    # Override last_payload_snapshot with webhook data and run sync
    # We temporarily set last_payload_snapshot so the delta computes against it
    old_payload = job.last_payload_snapshot or {}
    changes = compute_delta(old_payload, new_payload, job.column_mapping or {})

    if not changes:
        return {
            "status": "no_changes",
            "project_id": str(project_id),
            "message": "Webhook received but no mapped field changes detected",
        }

    # Run sync using the already-fetched payload (avoid double-fetch)
    # Patch job snapshot so run_sync_job will detect the changes
    job.last_payload_snapshot = old_payload  # keep old for delta in run_sync_job
    # Force hash mismatch
    job.last_data_hash = None

    background_tasks.add_task(_run_webhook_sync_background, job.id, new_payload)

    return {
        "status": "queued",
        "project_id": str(project_id),
        "job_id": str(job.id),
        "detected_changes": len(changes),
        "changed_fields": [c.field_name for c in changes],
        "message": "Webhook accepted. Delta detected and sync queued for background processing.",
    }


async def _run_webhook_sync_background(job_id: UUID, incoming_payload: dict) -> None:
    """
    Background task that applies a webhook-received payload as if it were a poll result.
    Runs in a fresh DB session since BackgroundTasks run after response is sent.
    """
    from app.database import AsyncSessionLocal
    from app.services.live_sync_service import apply_delta_to_project, trigger_ml_refresh
    from app.models.live_sync import ChangeSource

    async with AsyncSessionLocal() as db:
        try:
            job = await db.get(LiveSyncJob, job_id)
            if not job:
                return

            old_payload = job.last_payload_snapshot or {}
            changes = compute_delta(old_payload, incoming_payload, job.column_mapping or {})
            if not changes:
                return

            from app.models.project import Project
            project = await db.get(Project, job.project_id)
            if not project:
                return

            log_rows = await apply_delta_to_project(
                db=db, project=project, changes=changes,
                sync_job_id=job.id, changed_by=ChangeSource.WEBHOOK,
            )
            await db.flush()
            await trigger_ml_refresh(db, job.project_id, log_rows)

            import hashlib, json
            payload_bytes = json.dumps(incoming_payload, sort_keys=True, default=str).encode()
            job.last_data_hash = hashlib.md5(payload_bytes).hexdigest()  # noqa: S324
            job.last_payload_snapshot = incoming_payload
            job.last_polled_at = datetime.now(timezone.utc)
            job.last_successful_sync_at = datetime.now(timezone.utc)
            job.consecutive_failures = 0

            await db.commit()
        except Exception as exc:
            await db.rollback()
            import logging
            logging.getLogger(__name__).error("Webhook background sync failed: %s", exc)
