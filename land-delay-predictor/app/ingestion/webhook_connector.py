"""
Webhook connector (future). No government system currently pushes land
acquisition events, so this is wired but inert: the endpoint exists
(app/api/main.py -> POST /webhooks/{source_id}) and stages whatever it
receives, flagged pending_verification, so it can be activated for a real
source later without any schema or pipeline change. The ETL step will not
promote pending_verification records until a human/admin confirms the source
is trusted (see app/etl/pipeline.py).
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.db.staging import RawRecord


def stage_webhook_event(session: Session, source_id: str, payload: dict[str, Any]) -> str:
    record = RawRecord(
        id=str(uuid.uuid4()),
        source_id=source_id,
        ingestion_log_id=None,
        payload_json=json.dumps({**payload, "_pending_verification": True}, default=str),
        received_at=datetime.utcnow(),
    )
    session.add(record)
    session.commit()
    return record.id
