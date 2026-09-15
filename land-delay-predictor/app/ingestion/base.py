"""
Shared base for every connector type. A connector's only job is:
  1. Pull/receive raw records from its source.
  2. Write them into `raw_records` (staging) untouched, tagged with source_id
     and an ingestion_log_id.
  3. Update the IngestionLog with counts and status.

Field mapping (source field names -> canonical field names) and any per-source
transform rules live in YAML under config/sources/, loaded here and used by the
ETL step (not by the connector itself) — connectors never interpret payloads,
they only capture them. This keeps every connector trivial and keeps all the
"what do these fields mean" logic in one reviewable place (the mapping config).
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Iterable

import yaml
from sqlalchemy.orm import Session

from app.db.schema import IngestionLog, IngestionSource
from app.db.staging import RawRecord


def load_source_config(config_path: str) -> dict:
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def start_ingestion_log(session: Session, source_id: str, triggered_by: str) -> IngestionLog:
    log = IngestionLog(
        id=str(uuid.uuid4()),
        source_id=source_id,
        run_started_at=datetime.utcnow(),
        status="running",
        triggered_by=triggered_by,
    )
    session.add(log)
    session.commit()
    return log


def finish_ingestion_log(
    session: Session,
    log: IngestionLog,
    records_pulled: int,
    records_staged: int,
    status: str = "success",
    error_detail: str | None = None,
) -> None:
    log.run_finished_at = datetime.utcnow()
    log.records_pulled = records_pulled
    log.records_staged = records_staged
    log.status = status
    log.error_detail = error_detail
    session.commit()


def stage_records(
    session: Session,
    source_id: str,
    ingestion_log_id: str,
    records: Iterable[dict[str, Any]],
) -> int:
    """Write raw records to staging. Returns count staged."""
    count = 0
    for record in records:
        session.add(
            RawRecord(
                id=str(uuid.uuid4()),
                source_id=source_id,
                ingestion_log_id=ingestion_log_id,
                payload_json=json.dumps(record, default=str),
                received_at=datetime.utcnow(),
            )
        )
        count += 1
    session.commit()
    return count


def get_or_create_source(
    session: Session, name: str, connector_type: str, config_path: str | None = None
) -> IngestionSource:
    source = session.query(IngestionSource).filter_by(name=name).first()
    if source:
        return source
    source = IngestionSource(
        id=str(uuid.uuid4()),
        name=name,
        connector_type=connector_type,
        config_path=config_path,
        is_active=True,
    )
    session.add(source)
    session.commit()
    return source
