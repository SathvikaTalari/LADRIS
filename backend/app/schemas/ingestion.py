"""
LADRIS — Pydantic Schemas for Multi-Source Ingestion Module
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─── Manual Form Ingestion Schemas ───────────────────────────────────────────

class ManualIngestionRequest(BaseModel):
    entity_type: str = Field(..., description="PROJECT | COMPENSATION | LEGAL_CASE | RR_RECORD | STAGE | STAKEHOLDER | GIS")
    data: Dict[str, Any] = Field(..., description="Key-value fields for the corresponding entity")
    source_name: Optional[str] = "Manual Form Entry"
    reporting_period: Optional[str] = None


class ManualIngestionResponse(BaseModel):
    success: bool
    entity_type: str
    record_id: str
    project_id: Optional[str] = None
    message: str
    ml_refreshed: bool = False
    ml_status: Optional[str] = None


# ─── CSV / Excel Schemas ──────────────────────────────────────────────────────

class ColumnMappingSuggestion(BaseModel):
    source_column: str
    target_field: Optional[str] = None
    confidence: float = 1.0


class CSVPreviewResponse(BaseModel):
    file_id: str
    file_name: str
    total_rows: int
    columns: List[str]
    sample_rows: List[Dict[str, Any]]
    suggested_entity: str
    suggested_mappings: Dict[str, str]
    available_target_fields: List[Dict[str, str]]


class CSVImportRequest(BaseModel):
    file_id: str
    target_entity: str = "PROJECT"  # PROJECT | COMPENSATION | LEGAL_CASE | RR_RECORD | GIS
    column_mapping: Dict[str, str]
    project_id: Optional[str] = None  # Needed if uploading child records (e.g. compensation, GIS)
    source_name: Optional[str] = None
    reporting_period: Optional[str] = None


class CSVImportSummary(BaseModel):
    job_id: str
    total_rows: int
    imported_rows: int
    duplicate_rows: int
    invalid_rows: int
    rejected_rows: int
    error_report_url: Optional[str] = None
    sample_errors: List[Dict[str, Any]] = []
    ml_refreshed_count: int = 0
    status: str


# ─── REST API External Ingestion Schemas ─────────────────────────────────────

class ExternalProjectItem(BaseModel):
    source_record_id: Optional[str] = None
    project_code: str
    name: str
    project_type: Optional[str] = "HIGHWAY"
    acquisition_act: Optional[str] = "RFCTLARR_2013"
    state_code: str
    district_codes: Optional[List[str]] = None
    executing_agency: Optional[str] = None
    nodal_agency: Optional[str] = None
    total_area_ha: Optional[float] = None
    area_acquired_ha: Optional[float] = None
    area_in_possession_ha: Optional[float] = None
    total_affected_families: Optional[int] = None
    families_compensated: Optional[int] = None
    families_rehabilitated: Optional[int] = None
    rehabilitation_progress_pct: Optional[float] = None
    estimated_compensation_inr: Optional[float] = None
    disbursed_compensation_inr: Optional[float] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    notification_3a_date: Optional[date] = None
    notification_3d_date: Optional[date] = None
    legal_case_count: Optional[int] = 0
    legal_case_status: Optional[str] = "NONE"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    custom_metadata: Optional[Dict[str, Any]] = None


class ExternalIngestionBatch(BaseModel):
    source_name: str = Field(..., description="Name of external system, e.g. BhoomiRashi, PM-GatiShakti")
    reporting_period: Optional[str] = None
    idempotency_key: Optional[str] = None
    projects: List[ExternalProjectItem] = Field(default_factory=list)
    records: Optional[List[Dict[str, Any]]] = None  # Generic records if not only projects


class ExternalIngestionResponse(BaseModel):
    job_id: str
    status: str
    total: int
    imported: int
    duplicates: int
    invalid: int
    errors: List[Dict[str, Any]] = []
    ml_refreshed_count: int = 0


# ─── PostgreSQL / External DB Import Schemas ──────────────────────────────────

class DatabaseTestRequest(BaseModel):
    connection_url: Optional[str] = None  # If not provided, falls back to settings.EXTERNAL_DB_URL
    table_name: str
    limit: int = 5


class DatabaseTestResponse(BaseModel):
    success: bool
    columns: List[str]
    sample_rows: List[Dict[str, Any]]
    total_rows_approx: Optional[int] = None
    error: Optional[str] = None


class DatabaseImportRequest(BaseModel):
    connection_url: Optional[str] = None
    table_name: str
    target_entity: str = "PROJECT"
    column_mapping: Dict[str, str]
    source_name: Optional[str] = None
    limit: Optional[int] = 1000
    project_id: Optional[str] = None


# ─── GIS Ingestion Schemas ────────────────────────────────────────────────────

class GISIngestionResponse(BaseModel):
    job_id: str
    file_name: str
    project_id: Optional[str] = None
    total_features: int
    valid_features: int
    invalid_features: int
    geometry_types: List[str]
    geojson_preview: Dict[str, Any]
    bounding_box: Optional[List[float]] = None  # [min_lng, min_lat, max_lng, max_lat]
    message: str


# ─── PDF / Document Ingestion Schemas ─────────────────────────────────────────

class ExtractedFieldDetail(BaseModel):
    value: Any
    confidence: float
    source_snippet: Optional[str] = None


class DocumentExtractResponse(BaseModel):
    document_id: str
    job_id: Optional[str] = None
    file_name: str
    file_size_bytes: int
    document_type: str
    extracted_text_preview: str
    extracted_fields: Dict[str, Any]
    field_details: Dict[str, ExtractedFieldDetail] = {}
    suggested_project_id: Optional[str] = None
    review_status: str = "NEEDS_REVIEW"


class DocumentConfirmRequest(BaseModel):
    document_id: str
    confirmed_fields: Dict[str, Any]
    create_project: bool = True
    project_id: Optional[str] = None
    target_entity: str = "PROJECT"


# ─── Ingestion Jobs & History Schemas ─────────────────────────────────────────

class IngestionJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_type: str
    source_name: str
    source_type: str
    source_file_name: Optional[str] = None
    status: str
    total_records: int
    valid_records: int
    invalid_records: int
    duplicate_records: int
    imported_records: int
    project_id: Optional[UUID] = None
    reporting_period: Optional[str] = None
    error_summary: List[Any] = []
    created_at: datetime
    completed_at: Optional[datetime] = None


class IngestionHistoryResponse(BaseModel):
    total: int
    jobs: List[IngestionJobResponse]
