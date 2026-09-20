"""
LADRIS -- Notification Logs API
Read-only endpoint to view email/SMS delivery history per alert.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.misc import NotificationLog
from app.schemas.misc import NotificationLogResponse

router = APIRouter(prefix="/notification-logs", tags=["Notification Logs"])


@router.get("/", response_model=List[NotificationLogResponse])
async def list_notification_logs(
    alert_id: Optional[uuid.UUID] = Query(None, description="Filter by alert ID"),
    channel: Optional[str] = Query(None, description="Filter by channel: email or sms"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return recent notification delivery logs, optionally filtered by alert or channel."""
    query = select(NotificationLog).order_by(desc(NotificationLog.sent_at)).limit(limit)
    if alert_id:
        query = query.where(NotificationLog.alert_id == alert_id)
    if channel:
        query = query.where(NotificationLog.channel == channel.lower())
    result = await db.execute(query)
    return result.scalars().all()
