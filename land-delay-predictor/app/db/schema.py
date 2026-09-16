"""
Canonical schema for the land acquisition delay predictor.

Every ingestion connector (REST, DB, CSV/XLSX, manual upload, scheduled, webhook)
writes raw payloads to the `staging` tables (see staging.py) with full source
lineage. The ETL pipeline (app/etl/pipeline.py) is the ONLY thing that writes into
these canonical tables. The ML pipeline (app/ml/*) reads exclusively from here —
it never touches staging directly, so it is fully agnostic to which connector a
given record arrived through.

Lifecycle stages modeled (matches the PS's described lifecycle):
    NOTIFICATION -> SURVEY -> APPROVAL -> COMPENSATION -> LEGAL_RESOLUTION
    -> REHABILITATION -> POSSESSION -> COMPLETED
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def _uuid() -> str:
    return str(uuid.uuid4())


class LifecycleStage(str, enum.Enum):
    NOTIFICATION = "notification"
    SURVEY = "survey"
    APPROVAL = "approval"
    COMPENSATION = "compensation"
    LEGAL_RESOLUTION = "legal_resolution"
    REHABILITATION = "rehabilitation"
    POSSESSION = "possession"
    COMPLETED = "completed"


class RiskCategory(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Project(Base):
    """
    One row per land acquisition project. This is the entity everything else
    (timeline events, compensation, legal disputes, rehabilitation, risk scores)
    hangs off via project_id.
    """
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=_uuid)
    # ID as used by the originating source system, kept for traceability/dedup
    external_project_id = Column(String, nullable=False)
    source_id = Column(String, ForeignKey("ingestion_sources.id"), nullable=False)

    project_name = Column(String, nullable=False)
    project_type = Column(String, nullable=False)  # e.g. highway, railway, irrigation, industrial corridor
    implementing_agency = Column(String, nullable=True)  # e.g. NHAI, state PWD
    state = Column(String, nullable=False)
    district = Column(String, nullable=False)

    land_area_hectares = Column(Float, nullable=True)
    affected_families_count = Column(Integer, nullable=True)

    notification_date = Column(DateTime, nullable=True)
    expected_completion_date = Column(DateTime, nullable=True)
    actual_completion_date = Column(DateTime, nullable=True)

    current_stage = Column(Enum(LifecycleStage), nullable=True)
    is_delayed = Column(Boolean, nullable=True)  # ground truth label once known
    delay_days = Column(Integer, nullable=True)  # ground truth label once known

    geom = Column(Text, nullable=True)  # GeoJSON WKT/WKB or None; PostGIS optional

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stage_events = relationship("StageEvent", back_populates="project")
    compensation_records = relationship("CompensationRecord", back_populates="project")
    legal_disputes = relationship("LegalDispute", back_populates="project")
    rehabilitation = relationship("RehabilitationRecord", back_populates="project", uselist=False)
    stakeholder_updates = relationship("StakeholderUpdate", back_populates="project")
    risk_scores = relationship("RiskScore", back_populates="project")
    snapshots = relationship("ProjectSnapshot", back_populates="project")

    __table_args__ = (
        UniqueConstraint("source_id", "external_project_id", name="uq_source_external_project"),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def to_dict(self):
        """Convert project to dictionary for snapshot creation."""
        return {
            "id": self.id,
            "project_type": self.project_type,
            "state": self.state,
            "district": self.district,
            "implementing_agency": self.implementing_agency,
            "land_area_hectares": self.land_area_hectares,
            "affected_families_count": self.affected_families_count,
            "notification_date": self.notification_date,
            "expected_completion_date": self.expected_completion_date,
            "current_stage": self.current_stage,
            "is_delayed": self.is_delayed,
            "delay_days": self.delay_days,
        }


class ProjectSnapshot(Base):
    """
    Time-aware ML training snapshot for one project.

    A single project may have multiple snapshots at different dates so the model
    can learn how delay risk changes as the project progresses. Each snapshot
    captures the feature values that were known on ``snapshot_date`` and the
    eventual outcome in ``delayed_target`` (0 = not delayed, 1 = delayed).

    ``delay_days`` and ``actual_completion_date`` are retained only for
    evaluation / label creation and must never be used as input features.
    """
    __tablename__ = "project_snapshots"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)

    snapshot_date = Column(DateTime, nullable=False)
    delayed_target = Column(Integer, nullable=True)  # 0 = not delayed, 1 = delayed

    # Optional ground-truth fields used only for evaluation / label creation.
    delay_days = Column(Integer, nullable=True)
    actual_completion_date = Column(DateTime, nullable=True)

    # The 23 predictive feature columns (see app/ml/features.py).
    project_type = Column(String, nullable=True)
    state = Column(String, nullable=True)
    district = Column(String, nullable=True)
    implementing_agency = Column(String, nullable=True)
    land_area_hectares = Column(Float, nullable=True)
    affected_families_count = Column(Integer, nullable=True)
    days_since_notification = Column(Integer, nullable=True)
    days_to_expected_completion = Column(Integer, nullable=True)
    compensation_sanctioned = Column(Float, nullable=True)
    compensation_disbursed = Column(Float, nullable=True)
    compensation_disbursement_pct = Column(Float, nullable=True)
    days_since_last_disbursement = Column(Integer, nullable=True)
    legal_dispute_count = Column(Integer, nullable=True)
    open_legal_dispute_count = Column(Integer, nullable=True)
    max_dispute_pendency_days = Column(Integer, nullable=True)
    rehabilitation_progress_pct = Column(Float, nullable=True)
    resettlement_site_ready = Column(Boolean, nullable=True)
    stakeholder_update_count_90d = Column(Integer, nullable=True)
    avg_days_between_updates = Column(Float, nullable=True)
    stage_count_recorded = Column(Integer, nullable=True)
    current_stage = Column(Enum(LifecycleStage), nullable=True)
    district_historical_delay_rate = Column(Float, nullable=True)
    agency_historical_delay_rate = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="snapshots")

    __table_args__ = (
        UniqueConstraint("project_id", "snapshot_date", name="uq_project_snapshot_date"),
    )


class StageEvent(Base):
    """Timestamped entry/exit of each lifecycle stage -> gives per-stage duration."""
    __tablename__ = "stage_events"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    stage = Column(Enum(LifecycleStage), nullable=False)
    entered_at = Column(DateTime, nullable=False)
    exited_at = Column(DateTime, nullable=True)  # null = currently in this stage
    notes = Column(Text, nullable=True)

    project = relationship("Project", back_populates="stage_events")


class CompensationRecord(Base):
    __tablename__ = "compensation_records"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    amount_sanctioned = Column(Float, nullable=True)
    amount_disbursed = Column(Float, nullable=True)
    disbursement_pct = Column(Float, nullable=True)  # derived, but stored for convenience
    sanction_date = Column(DateTime, nullable=True)
    last_disbursement_date = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="compensation_records")


class LegalDispute(Base):
    __tablename__ = "legal_disputes"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    dispute_type = Column(String, nullable=True)  # e.g. valuation, ownership, consent
    filed_date = Column(DateTime, nullable=True)
    resolved_date = Column(DateTime, nullable=True)  # null = still pending
    court_level = Column(String, nullable=True)

    project = relationship("Project", back_populates="legal_disputes")


class RehabilitationRecord(Base):
    __tablename__ = "rehabilitation_records"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, unique=True)
    families_to_resettle = Column(Integer, nullable=True)
    families_resettled = Column(Integer, nullable=True)
    resettlement_site_ready = Column(Boolean, nullable=True)
    progress_pct = Column(Float, nullable=True)

    project = relationship("Project", back_populates="rehabilitation")


class StakeholderUpdate(Base):
    """Used to derive a 'stakeholder responsiveness' feature from update cadence."""
    __tablename__ = "stakeholder_updates"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    stakeholder_role = Column(String, nullable=True)  # e.g. district admin, requiring body
    update_date = Column(DateTime, nullable=False)
    update_type = Column(String, nullable=True)

    project = relationship("Project", back_populates="stakeholder_updates")


class RiskScore(Base):
    """Model output, stored per project per prediction run for audit/history."""
    __tablename__ = "risk_scores"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    predicted_at = Column(DateTime, default=datetime.utcnow)
    model_version = Column(String, nullable=False)

    risk_score = Column(Float, nullable=False)  # 0-100
    risk_category = Column(Enum(RiskCategory), nullable=False)
    predicted_delay_stage = Column(Enum(LifecycleStage), nullable=True)
    predicted_delay_days = Column(Float, nullable=True)
    predicted_delay_days_p10 = Column(Float, nullable=True)
    predicted_delay_days_p90 = Column(Float, nullable=True)

    top_drivers_json = Column(Text, nullable=True)  # SHAP-derived, JSON-encoded
    recommendations_json = Column(Text, nullable=True)

    project = relationship("Project", back_populates="risk_scores")


class IngestionSource(Base):
    """Registry of configured data sources across all connector types."""
    __tablename__ = "ingestion_sources"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False, unique=True)
    connector_type = Column(String, nullable=False)  # rest_api | database | file | manual | webhook
    config_path = Column(String, nullable=True)  # path to YAML mapping/config
    is_active = Column(Boolean, default=True)
    last_ingested_at = Column(DateTime, nullable=True)


class IngestionLog(Base):
    """Audit trail: every ingestion run, per source, with counts and status."""
    __tablename__ = "ingestion_logs"

    id = Column(String, primary_key=True, default=_uuid)
    source_id = Column(String, ForeignKey("ingestion_sources.id"), nullable=False)
    run_started_at = Column(DateTime, default=datetime.utcnow)
    run_finished_at = Column(DateTime, nullable=True)
    records_pulled = Column(Integer, default=0)
    records_staged = Column(Integer, default=0)
    records_promoted = Column(Integer, default=0)  # staging -> canonical
    records_rejected = Column(Integer, default=0)
    status = Column(String, default="running")  # running | success | failed
    error_detail = Column(Text, nullable=True)
    triggered_by = Column(String, nullable=True)  # user id, for manual uploads; "scheduler" otherwise
