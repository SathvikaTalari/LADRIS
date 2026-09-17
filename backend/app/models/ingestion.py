"""
LADRIS — SQLAlchemy Models: Ingestion Jobs, Raw Ingestion Records, Documents, Field Mappings, and Land Parcels.
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
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry

from app.database import Base


class IngestionJobType(str, enum.Enum):
    MANUAL = "MANUAL"
    CSV_EXCEL = "CSV_EXCEL"
    REST_API = "REST_API"
    DATABASE_IMPORT = "DATABASE_IMPORT"
    GIS = "GIS"
    DOCUMENT = "DOCUMENT"


class IngestionSourceType(str, enum.Enum):
    FILE_UPLOAD = "FILE_UPLOAD"
    EXTERNAL_API = "EXTERNAL_API"
    DATABASE = "DATABASE"
    MANUAL_ENTRY = "MANUAL_ENTRY"


class IngestionJobStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    VALIDATING = "VALIDATING"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    IMPORTING = "IMPORTING"
    IMPORTED = "IMPORTED"
    FAILED = "FAILED"


class ValidationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VALID = "VALID"
    INVALID = "INVALID"
    DUPLICATE = "DUPLICATE"
    IMPORTED = "IMPORTED"
    REJECTED = "REJECTED"


class TargetEntity(str, enum.Enum):
    PROJECT = "PROJECT"
    COMPENSATION = "COMPENSATION"
    LEGAL_CASE = "LEGAL_CASE"
    RR_RECORD = "RR_RECORD"
    STAGE = "STAGE"
    GIS = "GIS"
    STAKEHOLDER = "STAKEHOLDER"


class DocumentType(str, enum.Enum):
    NOTIFICATION = "NOTIFICATION"
    SIA_REPORT = "SIA_REPORT"
    AWARD = "AWARD"
    COURT_ORDER = "COURT_ORDER"
    COMPENSATION_STATEMENT = "COMPENSATION_STATEMENT"
    APPROVAL_LETTER = "APPROVAL_LETTER"
    RR_DOCUMENT = "RR_DOCUMENT"
    OTHER = "OTHER"


class DocumentReviewStatus(str, enum.Enum):
    NEEDS_REVIEW = "NEEDS_REVIEW"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_type = Column(String(50), nullable=False)
    source_name = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False)
    source_file_name = Column(String(255), nullable=True)
    file_path = Column(Text, nullable=True)
    file_size_bytes = Column(BigInteger, nullable=True)
    mime_type = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="UPLOADED")

    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    invalid_records = Column(Integer, default=0)
    duplicate_records = Column(Integer, default=0)
    imported_records = Column(Integer, default=0)

    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    reporting_period = Column(String(100), nullable=True)
    mapping_config = Column(JSONB, default=dict)
    error_summary = Column(JSONB, default=list)

    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    raw_records = relationship("RawIngestionRecord", back_populates="job", cascade="all, delete-orphan")
    documents = relationship("SourceDocument", back_populates="job")


class RawIngestionRecord(Base):
    __tablename__ = "raw_ingestion_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("ingestion_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    row_index = Column(Integer, nullable=False)
    source_record_id = Column(String(255), nullable=True)
    raw_payload = Column(JSONB, nullable=False)
    normalized_payload = Column(JSONB, nullable=True)
    validation_status = Column(String(50), nullable=False, default="PENDING")
    validation_errors = Column(JSONB, default=list)
    target_entity = Column(String(50), nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    job = relationship("IngestionJob", back_populates="raw_records")


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("ingestion_jobs.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    document_type = Column(String(100), nullable=False, default="NOTIFICATION")
    file_name = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size_bytes = Column(BigInteger, nullable=True)
    mime_type = Column(String(100), default="application/pdf")
    extracted_text = Column(Text, nullable=True)
    extracted_fields = Column(JSONB, default=dict)
    user_confirmed_fields = Column(JSONB, default=dict)
    status = Column(String(50), nullable=False, default="NEEDS_REVIEW")

    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    confirmed_at = Column(DateTime(timezone=True), nullable=True)

    job = relationship("IngestionJob", back_populates="documents")


class FieldMappingRule(Base):
    __tablename__ = "field_mapping_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_name = Column(String(255), nullable=False)
    target_entity = Column(String(50), nullable=False)
    mapping_rules = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class LandParcel(Base):
    __tablename__ = "land_parcels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    khasra_number = Column(String(100), nullable=True)
    village = Column(String(255), nullable=True)
    tehsil = Column(String(255), nullable=True)
    district = Column(String(255), nullable=True)
    state_code = Column(String(10), nullable=True)
    area_ha = Column(Numeric(12, 4), nullable=True)
    land_use_type = Column(String(100), nullable=True)
    owner_count = Column(Integer, default=1)
    is_notified = Column(Boolean, default=False)
    is_awarded = Column(Boolean, default=False)
    is_compensated = Column(Boolean, default=False)
    is_in_possession = Column(Boolean, default=False)
    has_legal_dispute = Column(Boolean, default=False)
    geom = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=True)
    properties = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
