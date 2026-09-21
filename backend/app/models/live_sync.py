"""
LADRIS — SQLAlchemy ORM Models: Live Datasource Sync Engine
===========================================================
Tables:
  - live_sync_jobs       : one row per live external datasource linked to a project
  - project_change_log   : field-level audit trail of every detected change + ML trigger status
"""
import enum
import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class SyncSourceType(str, enum.Enum):
    REST_API = "REST_API"
    DATABASE = "DATABASE"


class ChangeSource(str, enum.Enum):
    LIVE_SYNC = "LIVE_SYNC"
    USER_EDIT = "USER_EDIT"
    INGESTION = "INGESTION"
    WEBHOOK = "WEBHOOK"
    SYSTEM = "SYSTEM"


# ─── LiveSyncJob ──────────────────────────────────────────────────────────────

class LiveSyncJob(Base):
    """
    One row per live external datasource linked to a LADRIS project.

    IMPORTANT: connection_url_encrypted and api_key_encrypted are stored as
    Fernet-encrypted ciphertext. Never store raw credentials.
    The LiveSyncService handles encrypt/decrypt transparently.
    """
    __tablename__ = "live_sync_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Linked LADRIS project
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # External datasource identity
    source_type = Column(
        Enum(SyncSourceType, name="sync_source_type"),
        nullable=False,
    )
    source_label = Column(String(255), nullable=True)

    # Connection credentials (always Fernet-encrypted before storage)
    connection_url_encrypted = Column(Text, nullable=False)
    api_key_encrypted = Column(Text, nullable=True)
    db_table_name = Column(String(255), nullable=True)

    # External → LADRIS project ID mapping
    ext_project_id = Column(String(255), nullable=False)
    ext_id_field = Column(String(100), nullable=False, default="id")

    # Field mapping: { "external_column": "ladris_field" }
    column_mapping = Column(JSONB, nullable=False, default=dict)

    # Scheduling
    sync_interval_mins = Column(Integer, nullable=False, default=60)
    is_active = Column(Boolean, nullable=False, default=True)

    # Sync state
    last_polled_at = Column(DateTime(timezone=True), nullable=True)
    last_successful_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_data_hash = Column(String(64), nullable=True)         # MD5 hex
    last_payload_snapshot = Column(JSONB, nullable=True)       # raw payload for delta reference

    # Error tracking
    consecutive_failures = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)

    # Webhook support
    webhook_secret = Column(String(128), nullable=True)        # HMAC-SHA256 secret

    # Metadata
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    project = relationship("Project", foreign_keys=[project_id])
    change_logs = relationship("ProjectChangeLog", back_populates="sync_job", lazy="select")

    def __repr__(self) -> str:
        return (
            f"<LiveSyncJob id={self.id} project_id={self.project_id} "
            f"source={self.source_type} ext_id={self.ext_project_id} "
            f"active={self.is_active}>"
        )


# ─── ProjectChangeLog ─────────────────────────────────────────────────────────

class ProjectChangeLog(Base):
    """
    Immutable field-level audit trail for every detected delta change in a project.

    One row per changed field per sync run. The ml_prediction_id is backfilled
    after the ML pipeline completes, linking the causal data change to its
    resulting prediction.
    """
    __tablename__ = "project_change_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sync_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("live_sync_jobs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Who/what caused the change
    changed_by = Column(String(50), nullable=False, default="LIVE_SYNC")

    # Delta details (text serialized for portability; cast on read)
    field_name = Column(String(150), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)

    # ML pipeline link (backfilled after prediction completes)
    ml_triggered = Column(Boolean, nullable=False, default=False)
    ml_prediction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ml_predictions.id", ondelete="SET NULL"),
        nullable=True,
    )

    changed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    sync_job = relationship("LiveSyncJob", back_populates="change_logs")

    def __repr__(self) -> str:
        return (
            f"<ProjectChangeLog id={self.id} project={self.project_id} "
            f"field={self.field_name} [{self.old_value!r} → {self.new_value!r}]>"
        )
