"""Raw operational records used to derive point-in-time ML features."""
import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class CompensationRecord(Base):
    __tablename__ = "compensation_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    awarded_amount_inr = Column(Numeric(20, 2), nullable=False, default=0)
    disbursed_amount_inr = Column(Numeric(20, 2), nullable=False, default=0)
    award_date = Column(Date, nullable=True)
    disbursement_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class LegalCaseRecord(Base):
    __tablename__ = "legal_cases"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    case_status = Column(String(50), nullable=False)
    filing_date = Column(Date, nullable=True)
    resolution_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class RehabilitationRecord(Base):
    __tablename__ = "rr_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    total_families_to_rehabilitate = Column(Integer, nullable=True)
    families_relocated = Column(Integer, nullable=True)
    resettlement_site_ready = Column(Boolean, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class StakeholderUpdate(Base):
    __tablename__ = "stakeholder_updates"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    stakeholder_role = Column(String(100), nullable=True)
    update_date = Column(DateTime(timezone=True), nullable=False)
    update_type = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
