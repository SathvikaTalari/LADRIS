"""
LADRIS — SQLAlchemy ORM Models: Project & Related Enums
"""
import enum
import uuid

from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ProjectStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    ACTIVE = "ACTIVE"
    DELAYED = "DELAYED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    ON_HOLD = "ON_HOLD"


class ProjectType(str, enum.Enum):
    HIGHWAY = "HIGHWAY"
    RAILWAY = "RAILWAY"
    METRO_RAIL = "METRO_RAIL"
    AIRPORT = "AIRPORT"
    PORT = "PORT"
    POWER_TRANSMISSION = "POWER_TRANSMISSION"
    PIPELINE = "PIPELINE"
    IRRIGATION = "IRRIGATION"
    URBAN_DEVELOPMENT = "URBAN_DEVELOPMENT"
    INDUSTRIAL_CORRIDOR = "INDUSTRIAL_CORRIDOR"
    DEFENCE = "DEFENCE"
    OTHER = "OTHER"


class AcquisitionAct(str, enum.Enum):
    RFCTLARR_2013 = "RFCTLARR_2013"
    NH_ACT_1956 = "NH_ACT_1956"
    RAILWAYS_ACT_1989 = "RAILWAYS_ACT_1989"
    ELECTRICITY_ACT_2003 = "ELECTRICITY_ACT_2003"
    STATE_SPECIFIC = "STATE_SPECIFIC"
    OTHER = "OTHER"


class RiskLevel(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_code = Column(String(50), unique=True, nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    project_type = Column(
        Enum(ProjectType, name="project_type"), nullable=False
    )
    acquisition_act = Column(
        Enum(AcquisitionAct, name="acquisition_act"),
        nullable=False,
        default=AcquisitionAct.RFCTLARR_2013,
    )
    status = Column(
        Enum(ProjectStatus, name="project_status"),
        nullable=False,
        default=ProjectStatus.DRAFT,
    )
    risk_level = Column(
        Enum(RiskLevel, name="risk_level"),
        nullable=False,
        default=RiskLevel.UNKNOWN,
    )

    nodal_agency = Column(String(255), nullable=True)
    executing_agency = Column(String(255), nullable=True)
    state_code = Column(String(3), nullable=False)
    district_codes = Column(ARRAY(String), nullable=False, default=list)
    tehsil_names = Column(ARRAY(Text), nullable=True, default=list)

    total_area_ha = Column(Numeric(14, 4), nullable=True)
    area_acquired_ha = Column(Numeric(14, 4), default=0)
    area_in_possession_ha = Column(Numeric(14, 4), default=0)

    total_affected_families = Column(Integer, default=0)
    families_compensated = Column(Integer, default=0)
    families_rehabilitated = Column(Integer, default=0)
    rehabilitation_progress_pct = Column(Numeric(5, 2), nullable=True)

    planned_start_date = Column(Date, nullable=True)
    planned_end_date = Column(Date, nullable=True)
    actual_start_date = Column(Date, nullable=True)
    actual_end_date = Column(Date, nullable=True)
    baseline_duration_days = Column(Integer, nullable=True)

    estimated_compensation_inr = Column(Numeric(20, 2), nullable=True)
    disbursed_compensation_inr = Column(Numeric(20, 2), default=0)

    # ─── Extended Real Data & Provenance Fields ─────────────────────────────
    notification_3a_date = Column(Date, nullable=True)
    notification_3d_date = Column(Date, nullable=True)
    delay_months = Column(Integer, nullable=True)
    delay_reason = Column(Text, nullable=True)
    legal_case_count = Column(Integer, default=0)
    legal_case_status = Column(String(50), nullable=True, default="NONE")
    milestone_data_status = Column(String(50), nullable=False, default="USER_ENTERED")
    latitude = Column(Numeric(9, 6), nullable=True)
    longitude = Column(Numeric(9, 6), nullable=True)
    lacrris_integration_status = Column(String(50), nullable=False, default="PLANNED")

    data_source_id = Column(
        UUID(as_uuid=True),
        ForeignKey("data_sources.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by = Column(
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
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    stages = relationship("ProjectStage", back_populates="project", lazy="selectin")
    alerts = relationship("Alert", back_populates="project", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Project {self.project_code}: {self.name}>"
