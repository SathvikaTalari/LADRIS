"""
LADRIS — SQLAlchemy ORM Models: Alert & Audit Log & Data Source
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
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.user import UserRole


# ─── Alert Models ─────────────────────────────────────────────────────────────

class AlertType(str, enum.Enum):
    STAGE_DELAY = "STAGE_DELAY"
    RISK_ESCALATION = "RISK_ESCALATION"
    LEGAL_CASE_FILED = "LEGAL_CASE_FILED"
    COMPENSATION_OVERDUE = "COMPENSATION_OVERDUE"
    POSSESSION_BLOCKED = "POSSESSION_BLOCKED"
    APPROVAL_PENDING = "APPROVAL_PENDING"
    RR_MILESTONE_MISSED = "RR_MILESTONE_MISSED"
    DATA_QUALITY = "DATA_QUALITY"
    SYSTEM = "SYSTEM"


class AlertSeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class AlertStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
    )
    alert_type = Column(Enum(AlertType, name="alert_type"), nullable=False)
    severity = Column(
        Enum(AlertSeverity, name="alert_severity"),
        nullable=False,
        default=AlertSeverity.MEDIUM,
    )
    status = Column(
        Enum(AlertStatus, name="alert_status"),
        nullable=False,
        default=AlertStatus.ACTIVE,
    )
    title = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)
    alert_metadata = Column("metadata", JSONB, default=dict)
    triggered_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    acknowledged_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    project = relationship("Project", back_populates="alerts")


# ─── Audit Log ────────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_email = Column(String(255), nullable=True)
    user_role = Column(Enum(UserRole, name="user_role"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)
    request_method = Column(String(10), nullable=True)
    request_path = Column(Text, nullable=True)
    request_body = Column(JSONB, nullable=True)
    response_status = Column(SmallInteger, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    timestamp = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


# ─── Data Source ──────────────────────────────────────────────────────────────

class DataStatus(str, enum.Enum):
    OFFICIAL_PUBLIC = "OFFICIAL_PUBLIC"
    DERIVED = "DERIVED"
    SYNTHETIC = "SYNTHETIC"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"


class DataSource(Base):
    __tablename__ = "data_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_name = Column(String(255), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    source_organization = Column(String(255), nullable=False)
    source_url = Column(Text, nullable=True)
    retrieval_date = Column(DateTime(timezone=True), nullable=True)
    data_period_start = Column(DateTime(timezone=True), nullable=True)
    data_period_end = Column(DateTime(timezone=True), nullable=True)
    data_status = Column(
        Enum(DataStatus, name="data_status"),
        nullable=False,
        default=DataStatus.PENDING_VERIFICATION,
    )
    record_count = Column(Integer, nullable=True)
    file_format = Column(String(50), nullable=True)
    storage_path = Column(Text, nullable=True)
    license = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


# ─── Notification Log ─────────────────────────────────────────────────────────

class NotificationLog(Base):
    """Records each email/SMS delivery attempt for an alert (Sent/Failed + timestamp)."""
    __tablename__ = "notification_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    alert_id = Column(
        UUID(as_uuid=True),
        ForeignKey("alerts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    channel = Column(String(10), nullable=False)   # "email" | "sms"
    recipient = Column(String(255), nullable=True)  # email address or phone number
    status = Column(String(50), nullable=False)     # "SENT" | "FAILED" | "SIMULATED"
    sent_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    error_msg = Column(Text, nullable=True)
