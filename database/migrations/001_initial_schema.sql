-- =============================================================================
-- LandPulse AI — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Runs automatically via docker-entrypoint-initdb.d on first container start.
-- =============================================================================
-- This schema is for STRUCTURAL PURPOSES ONLY.
-- No fabricated government project data is inserted here.
-- =============================================================================

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- for text search

-- =============================================================================
-- ENUMERATIONS
-- =============================================================================

CREATE TYPE user_role AS ENUM (
    'SUPER_ADMIN',
    'STATE_ADMIN',
    'DISTRICT_OFFICER',
    'PROJECT_OFFICER',
    'ANALYST',
    'VIEWER'
);

CREATE TYPE project_status AS ENUM (
    'DRAFT',
    'UNDER_REVIEW',
    'APPROVED',
    'ACTIVE',
    'DELAYED',
    'COMPLETED',
    'CANCELLED',
    'ON_HOLD'
);

CREATE TYPE project_type AS ENUM (
    'HIGHWAY',
    'RAILWAY',
    'METRO_RAIL',
    'AIRPORT',
    'PORT',
    'POWER_TRANSMISSION',
    'PIPELINE',
    'IRRIGATION',
    'URBAN_DEVELOPMENT',
    'INDUSTRIAL_CORRIDOR',
    'DEFENCE',
    'OTHER'
);

CREATE TYPE acquisition_act AS ENUM (
    'RFCTLARR_2013',
    'NH_ACT_1956',
    'RAILWAYS_ACT_1989',
    'ELECTRICITY_ACT_2003',
    'STATE_SPECIFIC',
    'OTHER'
);

CREATE TYPE risk_level AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
    'UNKNOWN'
);

CREATE TYPE stage_name AS ENUM (
    'PRELIMINARY_NOTIFICATION',    -- Section 11 notification
    'SOCIAL_IMPACT_ASSESSMENT',    -- SIA under RFCTLARR
    'EXPERT_GROUP_REVIEW',
    'SECTION_19_DECLARATION',      -- Declaration of acquisition
    'SECTION_21_OBJECTIONS',       -- Hearing of objections
    'AWARD_PREPARATION',           -- Section 23 / compensation
    'AWARD_ANNOUNCEMENT',
    'COMPENSATION_DISBURSEMENT',
    'REHABILITATION_RESETTLEMENT',
    'POSSESSION',
    'MUTATION',
    'PROJECT_HANDOVER'
);

CREATE TYPE stage_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'DELAYED',
    'BLOCKED'
);

CREATE TYPE legal_case_type AS ENUM (
    'WRIT_PETITION',
    'CIVIL_SUIT',
    'REFERENCE_CASE',
    'ARBITRATION',
    'PUBLIC_INTEREST_LITIGATION',
    'CRIMINAL_COMPLAINT',
    'OTHER'
);

CREATE TYPE legal_case_status AS ENUM (
    'FILED',
    'PENDING',
    'STAYED',
    'DISMISSED',
    'RESOLVED',
    'APPEALED'
);

CREATE TYPE alert_type AS ENUM (
    'STAGE_DELAY',
    'RISK_ESCALATION',
    'LEGAL_CASE_FILED',
    'COMPENSATION_OVERDUE',
    'POSSESSION_BLOCKED',
    'APPROVAL_PENDING',
    'RR_MILESTONE_MISSED',
    'DATA_QUALITY',
    'SYSTEM'
);

CREATE TYPE alert_severity AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
    'INFO'
);

CREATE TYPE alert_status AS ENUM (
    'ACTIVE',
    'ACKNOWLEDGED',
    'RESOLVED',
    'DISMISSED'
);

CREATE TYPE data_status AS ENUM (
    'OFFICIAL_PUBLIC',    -- Sourced from official government/public portals
    'DERIVED',            -- Computed or transformed from official data
    'SYNTHETIC',          -- Artificially generated for testing — NOT real data
    'PENDING_VERIFICATION'
);

-- =============================================================================
-- TABLE: users
-- =============================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(512) NOT NULL,
    role            user_role NOT NULL DEFAULT 'VIEWER',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,

    -- Geographic scope (nullable = national access)
    state_code      VARCHAR(3),      -- ISO 3166-2:IN state code e.g. 'MH'
    district_code   VARCHAR(10),     -- Revenue district code

    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ      -- soft-delete
);

-- =============================================================================
-- TABLE: projects
-- =============================================================================
CREATE TABLE projects (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_code            VARCHAR(50) UNIQUE NOT NULL,  -- e.g. "MH-NH-2024-001"
    name                    TEXT NOT NULL,
    description             TEXT,
    project_type            project_type NOT NULL,
    acquisition_act         acquisition_act NOT NULL DEFAULT 'RFCTLARR_2013',
    status                  project_status NOT NULL DEFAULT 'DRAFT',
    risk_level              risk_level NOT NULL DEFAULT 'UNKNOWN',

    -- Executing agency
    nodal_agency            VARCHAR(255),
    executing_agency        VARCHAR(255),
    state_code              VARCHAR(3) NOT NULL,      -- primary state
    district_codes          VARCHAR(10)[] NOT NULL DEFAULT '{}',
    tehsil_names            TEXT[] DEFAULT '{}',

    -- Land extent
    total_area_ha           NUMERIC(14,4),            -- total area in hectares
    area_acquired_ha        NUMERIC(14,4) DEFAULT 0,
    area_in_possession_ha   NUMERIC(14,4) DEFAULT 0,

    -- Affected population
    total_affected_families INTEGER DEFAULT 0,
    families_compensated    INTEGER DEFAULT 0,
    families_rehabilitated  INTEGER DEFAULT 0,

    -- Timeline
    planned_start_date      DATE,
    planned_end_date        DATE,
    actual_start_date       DATE,
    actual_end_date         DATE,
    baseline_duration_days  INTEGER,

    -- Financial (INR)
    estimated_compensation_inr  NUMERIC(20,2),
    disbursed_compensation_inr  NUMERIC(20,2) DEFAULT 0,

    -- Geospatial — project boundary (MultiPolygon via PostGIS)
    geom                    geometry(MultiPolygon, 4326),

    -- Metadata
    data_source_id          UUID,   -- FK to data_sources (added after table)
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

-- =============================================================================
-- TABLE: project_stages
-- =============================================================================
CREATE TABLE project_stages (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    stage_name          stage_name NOT NULL,
    stage_order         SMALLINT NOT NULL,
    status              stage_status NOT NULL DEFAULT 'PENDING',

    planned_start_date  DATE,
    planned_end_date    DATE,
    actual_start_date   DATE,
    actual_end_date     DATE,
    delay_days          INTEGER GENERATED ALWAYS AS (
                            CASE
                                WHEN actual_end_date IS NOT NULL AND planned_end_date IS NOT NULL
                                    THEN (actual_end_date - planned_end_date)
                                ELSE 0
                            END
                        ) STORED,

    -- Risk at stage level (populated by ML in Phase 2)
    stage_risk_level    risk_level DEFAULT 'UNKNOWN',
    delay_probability   NUMERIC(5,4),   -- 0.0000 – 1.0000

    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (project_id, stage_name)
);

-- =============================================================================
-- TABLE: project_events
-- =============================================================================
CREATE TABLE project_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    stage_id        UUID REFERENCES project_stages(id) ON DELETE SET NULL,
    event_date      DATE NOT NULL,
    event_type      VARCHAR(100) NOT NULL,   -- e.g. "NOTIFICATION_ISSUED"
    description     TEXT NOT NULL,
    actor           VARCHAR(255),            -- officer/department responsible
    document_ref    VARCHAR(255),            -- official order/notification number
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: land_parcels
-- =============================================================================
CREATE TABLE land_parcels (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    khasra_number       VARCHAR(50),            -- survey/khasra number
    village             VARCHAR(255),
    tehsil              VARCHAR(255),
    district            VARCHAR(255),
    state_code          VARCHAR(3),
    area_ha             NUMERIC(10,4),
    land_use_type       VARCHAR(100),           -- agricultural, forest, urban etc.
    owner_count         INTEGER DEFAULT 1,

    -- Acquisition status
    is_notified         BOOLEAN DEFAULT FALSE,
    is_awarded          BOOLEAN DEFAULT FALSE,
    is_compensated      BOOLEAN DEFAULT FALSE,
    is_in_possession    BOOLEAN DEFAULT FALSE,
    has_legal_dispute   BOOLEAN DEFAULT FALSE,

    -- Geospatial — individual parcel boundary
    geom                geometry(Polygon, 4326),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: compensation_records
-- =============================================================================
CREATE TABLE compensation_records (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    land_parcel_id          UUID REFERENCES land_parcels(id) ON DELETE SET NULL,
    beneficiary_name        VARCHAR(255),
    beneficiary_id_ref      VARCHAR(100),           -- Aadhaar hash or reference ID
    compensation_type       VARCHAR(100) NOT NULL,  -- LAND, STRUCTURE, TREE, SOLATIUM, etc.
    awarded_amount_inr      NUMERIC(20,2) NOT NULL DEFAULT 0,
    disbursed_amount_inr    NUMERIC(20,2) NOT NULL DEFAULT 0,
    award_date              DATE,
    disbursement_date       DATE,
    is_disputed             BOOLEAN DEFAULT FALSE,
    dispute_ref             VARCHAR(255),
    payment_mode            VARCHAR(50),            -- RTGS, CHEQUE, ESCROW
    bank_ref                VARCHAR(100),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: legal_cases
-- =============================================================================
CREATE TABLE legal_cases (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    land_parcel_id      UUID REFERENCES land_parcels(id) ON DELETE SET NULL,
    case_number         VARCHAR(100),
    court_name          VARCHAR(255),
    case_type           legal_case_type NOT NULL,
    case_status         legal_case_status NOT NULL DEFAULT 'FILED',
    filing_date         DATE,
    next_hearing_date   DATE,
    resolution_date     DATE,
    petitioner          TEXT,
    respondent          TEXT,
    summary             TEXT,
    stay_on_acquisition BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: rr_records (Rehabilitation & Resettlement)
-- =============================================================================
CREATE TABLE rr_records (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id                  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    rr_plan_approved            BOOLEAN DEFAULT FALSE,
    rr_plan_approval_date       DATE,
    total_families_to_rehabilitate  INTEGER DEFAULT 0,
    families_relocated          INTEGER DEFAULT 0,
    families_given_housing      INTEGER DEFAULT 0,
    families_given_livelihood   INTEGER DEFAULT 0,
    rr_budget_inr               NUMERIC(20,2),
    rr_spent_inr                NUMERIC(20,2) DEFAULT 0,
    grievance_count             INTEGER DEFAULT 0,
    grievance_resolved_count    INTEGER DEFAULT 0,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: approvals
-- =============================================================================
CREATE TABLE approvals (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    approval_type       VARCHAR(255) NOT NULL,   -- e.g. "ENVIRONMENT_CLEARANCE"
    approving_authority VARCHAR(255),
    submitted_date      DATE,
    expected_date       DATE,
    approved_date       DATE,
    is_approved         BOOLEAN DEFAULT FALSE,
    is_pending          BOOLEAN DEFAULT TRUE,
    delay_days          INTEGER,
    reference_number    VARCHAR(100),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: possessions
-- =============================================================================
CREATE TABLE possessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    land_parcel_id      UUID REFERENCES land_parcels(id) ON DELETE SET NULL,
    planned_date        DATE,
    actual_date         DATE,
    is_taken            BOOLEAN DEFAULT FALSE,
    obstruction_reason  TEXT,
    obstruction_type    VARCHAR(100),   -- LEGAL_STAY, PHYSICAL, ENCROACHMENT, etc.
    resolution_date     DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: predictions (Phase 2 — schema ready)
-- =============================================================================
CREATE TABLE predictions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    model_version           VARCHAR(50) NOT NULL,
    prediction_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    overall_risk_score      NUMERIC(5,4) NOT NULL,   -- 0.0000 – 1.0000
    delay_probability       NUMERIC(5,4) NOT NULL,
    risk_level              risk_level NOT NULL,
    predicted_delay_days    INTEGER,
    confidence_score        NUMERIC(5,4),
    feature_snapshot        JSONB,     -- feature vector snapshot at prediction time
    shap_values             JSONB,     -- SHAP explainability output
    model_metadata          JSONB,     -- model hyperparameters, training date, etc.
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: stage_predictions (Phase 2 — schema ready)
-- =============================================================================
CREATE TABLE stage_predictions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    stage_id            UUID NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
    prediction_id       UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    stage_risk_score    NUMERIC(5,4) NOT NULL,
    delay_probability   NUMERIC(5,4) NOT NULL,
    risk_level          risk_level NOT NULL,
    predicted_delay_days INTEGER,
    shap_values         JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: risk_factors
-- =============================================================================
CREATE TABLE risk_factors (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_id       UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    factor_name         VARCHAR(255) NOT NULL,
    factor_category     VARCHAR(100),  -- LEGAL, FINANCIAL, ADMINISTRATIVE, etc.
    importance_score    NUMERIC(8,4),  -- SHAP value or feature importance
    direction           VARCHAR(10),   -- POSITIVE (increases risk) / NEGATIVE
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: recommendations
-- =============================================================================
CREATE TABLE recommendations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    prediction_id       UUID REFERENCES predictions(id) ON DELETE SET NULL,
    recommendation_text TEXT NOT NULL,
    category            VARCHAR(100),      -- LEGAL, COMPENSATION, ADMIN, etc.
    priority            SMALLINT DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    estimated_impact    VARCHAR(50),       -- e.g. "REDUCES_DELAY_30_DAYS"
    is_accepted         BOOLEAN,
    accepted_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    accepted_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: intervention_scenarios (What-if simulation — Phase 2)
-- =============================================================================
CREATE TABLE intervention_scenarios (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    scenario_name           VARCHAR(255) NOT NULL,
    description             TEXT,
    interventions_applied   JSONB NOT NULL DEFAULT '[]',  -- list of changes simulated
    baseline_risk_score     NUMERIC(5,4),
    simulated_risk_score    NUMERIC(5,4),
    baseline_delay_days     INTEGER,
    simulated_delay_days    INTEGER,
    simulation_metadata     JSONB,
    is_approved             BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: alerts
-- =============================================================================
CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    alert_type      alert_type NOT NULL,
    severity        alert_severity NOT NULL DEFAULT 'MEDIUM',
    status          alert_status NOT NULL DEFAULT 'ACTIVE',
    title           VARCHAR(500) NOT NULL,
    message         TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: audit_logs
-- =============================================================================
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email      VARCHAR(255),     -- denormalized for forensic purposes
    user_role       user_role,
    action          VARCHAR(100) NOT NULL,    -- e.g. "CREATE_PROJECT"
    resource_type   VARCHAR(100),             -- e.g. "project"
    resource_id     UUID,
    ip_address      INET,
    user_agent      TEXT,
    request_method  VARCHAR(10),
    request_path    TEXT,
    request_body    JSONB,            -- sanitized (no passwords)
    response_status SMALLINT,
    duration_ms     INTEGER,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE: data_sources
-- =============================================================================
CREATE TABLE data_sources (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_name        VARCHAR(255) NOT NULL UNIQUE,
    description         TEXT,
    source_organization VARCHAR(255) NOT NULL,
    source_url          TEXT,
    retrieval_date      DATE,
    data_period_start   DATE,
    data_period_end     DATE,
    data_status         data_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
    record_count        INTEGER,
    file_format         VARCHAR(50),    -- CSV, JSON, SHAPEFILE, API, etc.
    storage_path        TEXT,           -- relative path within /ml/data/
    license             TEXT,
    notes               TEXT,
    is_active           BOOLEAN DEFAULT TRUE,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Add FK from projects to data_sources (circular dependency resolution)
-- =============================================================================
ALTER TABLE projects
    ADD CONSTRAINT fk_projects_data_source
    FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE SET NULL;
