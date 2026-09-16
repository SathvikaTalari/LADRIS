"""
LADRIS — API v1: Audit Trails & Security Logging (Requirement #12)
Exposes read-only audit trails for administrative review and compliance.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.misc import AuditLog
from app.models.user import User, UserRole

audit_router = APIRouter(prefix="/audit", tags=["Audit Trails"])


def require_admin_or_analyst(user: User = Depends(get_current_user)) -> User:
    """Only administrators and policy analysts can inspect audit logs."""
    allowed = {UserRole.SUPER_ADMIN, UserRole.STATE_ADMIN, UserRole.CENTRAL_ADMIN, UserRole.POLICY_ANALYST, UserRole.ANALYST}
    role = getattr(user.role, "value", str(user.role))
    if user.role not in allowed and role not in {r.value if hasattr(r, "value") else str(r) for r in allowed}:
        raise HTTPException(
            status_code=403,
            detail="Access restricted to administrators and compliance analysts.",
        )
    return user


@audit_router.get("/")
async def list_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action name (e.g., USER_LOGIN, PROJECT_CREATE)"),
    resource_type: Optional[str] = Query(None, description="Filter by resource (e.g., project, user, prediction)"),
    user_email: Optional[str] = Query(None, description="Filter by user email"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_or_analyst),
) -> Dict[str, Any]:
    """
    List comprehensive audit trail entries with filtering, pagination,
    and actor details.
    """
    query = select(AuditLog)

    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if user_email:
        query = query.where(AuditLog.user_email.ilike(f"%{user_email}%"))

    # Count total matching entries
    count_query = select(func.count(AuditLog.id))
    if action:
        count_query = count_query.where(AuditLog.action.ilike(f"%{action}%"))
    if resource_type:
        count_query = count_query.where(AuditLog.resource_type == resource_type)
    if user_email:
        count_query = count_query.where(AuditLog.user_email.ilike(f"%{user_email}%"))

    total = (await db.execute(count_query)).scalar_one()

    # Fetch paginated items
    query = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)
    rows = (await db.execute(query)).scalars().all()

    items = []
    for r in rows:
        items.append({
            "id": str(r.id),
            "user_id": str(r.user_id) if r.user_id else None,
            "user_email": r.user_email,
            "user_role": r.user_role.value if hasattr(r.user_role, "value") else str(r.user_role) if r.user_role else None,
            "action": r.action,
            "resource_type": r.resource_type,
            "resource_id": str(r.resource_id) if r.resource_id else None,
            "ip_address": str(r.ip_address) if r.ip_address else None,
            "user_agent": r.user_agent,
            "request_method": r.request_method,
            "request_path": r.request_path,
            "request_body": r.request_body,
            "response_status": r.response_status,
            "duration_ms": r.duration_ms,
            "created_at": r.timestamp.isoformat() if r.timestamp else None,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        })

    return {
        "status": "success",
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items,
    }


@audit_router.get("/stats")
async def audit_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_or_analyst),
) -> Dict[str, Any]:
    """Summary statistics on system actions and security activities."""
    total_logs = (await db.execute(select(func.count(AuditLog.id)))).scalar_one()

    # Group by action
    action_counts = (await db.execute(
        select(AuditLog.action, func.count(AuditLog.id))
        .group_by(AuditLog.action)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
    )).all()

    # Group by resource type
    resource_counts = (await db.execute(
        select(AuditLog.resource_type, func.count(AuditLog.id))
        .where(AuditLog.resource_type.is_not(None))
        .group_by(AuditLog.resource_type)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
    )).all()

    return {
        "status": "success",
        "total_audit_records": total_logs,
        "top_actions": [{"action": a, "count": c} for a, c in action_counts],
        "top_resources": [{"resource_type": r, "count": c} for r, c in resource_counts],
    }
