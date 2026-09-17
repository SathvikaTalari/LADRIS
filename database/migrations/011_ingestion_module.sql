-- =============================================================================
-- Migration 011: Multi-Source Data Ingestion Module & PostGIS Spatial Storage
-- =============================================================================

-- Ensure PostGIS extension is available
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Ingestion Jobs Table
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type            VARCHAR(50) NOT NULL, -- MANUAL, CSV_EXCEL, REST_API, DATABASE_IMPORT, GIS, DOCUMENT
    source_name         VARCHAR(255) NOT NULL,
    source_type         VARCHAR(50) NOT NULL, -- FILE_UPLOAD, EXTERNAL_API, DATABASE, MANUAL_ENTRY
    source_file_name    VARCHAR(255),
    file_path           TEXT,
    file_size_bytes     BIGINT,
    mime_type           VARCHAR(100),
    status              VARCHAR(50) NOT NULL DEFAULT 'UPLOADED', -- UPLOADED, VALIDATING, NEEDS_REVIEW, IMPORTING, IMPORTED, FAILED
    total_records       INTEGER DEFAULT 0,
    valid_records       INTEGER DEFAULT 0,
    invalid_records     INTEGER DEFAULT 0,
    duplicate_records   INTEGER DEFAULT 0,
    imported_records    INTEGER DEFAULT 0,
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    reporting_period    VARCHAR(100),
    mapping_config      JSONB DEFAULT '{}',
    error_summary       JSONB DEFAULT '[]',
    uploaded_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

-- 2. Raw Ingestion Records Table (Audit & Provenance)
CREATE TABLE IF NOT EXISTS raw_ingestion_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
    row_index           INTEGER NOT NULL,
    source_record_id    VARCHAR(255),
    raw_payload         JSONB NOT NULL,
    normalized_payload  JSONB,
    validation_status   VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- VALID, INVALID, DUPLICATE, IMPORTED, REJECTED
    validation_errors   JSONB DEFAULT '[]',
    target_entity       VARCHAR(50) NOT NULL, -- PROJECT, COMPENSATION, LEGAL_CASE, RR_RECORD, STAGE, GIS, STAKEHOLDER
    target_id           UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Source Documents Table (PDFs, SIA Reports, Awards, Orders)
CREATE TABLE IF NOT EXISTS source_documents (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                  UUID REFERENCES ingestion_jobs(id) ON DELETE SET NULL,
    project_id              UUID REFERENCES projects(id) ON DELETE SET NULL,
    document_type           VARCHAR(100) NOT NULL, -- NOTIFICATION, SIA_REPORT, AWARD, COURT_ORDER, COMPENSATION_STATEMENT, APPROVAL_LETTER, RR_DOCUMENT, OTHER
    file_name               VARCHAR(255) NOT NULL,
    file_path               TEXT NOT NULL,
    file_size_bytes         BIGINT,
    mime_type               VARCHAR(100) DEFAULT 'application/pdf',
    extracted_text          TEXT,
    extracted_fields        JSONB DEFAULT '{}',
    user_confirmed_fields   JSONB DEFAULT '{}',
    status                  VARCHAR(50) NOT NULL DEFAULT 'NEEDS_REVIEW', -- NEEDS_REVIEW, CONFIRMED, REJECTED
    uploaded_by             UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at            TIMESTAMPTZ
);

-- 4. Reusable Field Mapping Rules Table
CREATE TABLE IF NOT EXISTS field_mapping_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name     VARCHAR(255) NOT NULL,
    target_entity   VARCHAR(50) NOT NULL,
    mapping_rules   JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Land Parcels / GIS Spatial Records Table
CREATE TABLE IF NOT EXISTS land_parcels (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    khasra_number       VARCHAR(100),
    village             VARCHAR(255),
    tehsil              VARCHAR(255),
    district            VARCHAR(255),
    state_code          VARCHAR(10),
    area_ha             NUMERIC(12, 4),
    land_use_type       VARCHAR(100),
    owner_count         INTEGER DEFAULT 1,
    is_notified         BOOLEAN DEFAULT FALSE,
    is_awarded          BOOLEAN DEFAULT FALSE,
    is_compensated      BOOLEAN DEFAULT FALSE,
    is_in_possession    BOOLEAN DEFAULT FALSE,
    has_legal_dispute   BOOLEAN DEFAULT FALSE,
    geom                geometry(Geometry, 4326),
    properties          JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for optimal querying
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_created_at ON ingestion_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_ingestion_job ON raw_ingestion_records(job_id);
CREATE INDEX IF NOT EXISTS idx_raw_ingestion_status ON raw_ingestion_records(validation_status);
CREATE INDEX IF NOT EXISTS idx_source_documents_project ON source_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_source_documents_status ON source_documents(status);
CREATE INDEX IF NOT EXISTS idx_land_parcels_project ON land_parcels(project_id);
CREATE INDEX IF NOT EXISTS idx_land_parcels_geom ON land_parcels USING GIST(geom);
