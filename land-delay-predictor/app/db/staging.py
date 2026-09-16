"""
Staging layer. Every connector — regardless of type — writes here first, as raw
JSON payloads plus lineage metadata. Nothing here is trusted yet: the ETL pipeline
validates, maps fields, and promotes rows into the canonical schema (schema.py).

Keeping raw payloads means a bad upload or a malformed API response never
corrupts canonical/training data, and re-running the ETL against a fixed mapping
config can reprocess historical staging rows without re-pulling from the source.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Boolean

from app.db.schema import Base

# Staging tables share the same declarative Base/metadata as the canonical
# schema (app/db/schema.py) so foreign keys between them (e.g. raw_records ->
# ingestion_sources) resolve correctly under a single metadata.create_all().
StagingBase = Base


def _uuid() -> str:
    return str(uuid.uuid4())


class RawRecord(StagingBase):
    """One raw ingested record (one project row/API item/DB row) as JSON."""
    __tablename__ = "raw_records"

    id = Column(String, primary_key=True, default=_uuid)
    source_id = Column(String, ForeignKey("ingestion_sources.id"), nullable=False)
    ingestion_log_id = Column(String, ForeignKey("ingestion_logs.id"), nullable=True)

    payload_json = Column(Text, nullable=False)  # raw record, untouched
    received_at = Column(DateTime, default=datetime.utcnow)

    promoted = Column(Boolean, default=False)  # has ETL processed this row
    promoted_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)  # set if ETL couldn't promote it
