-- ════════════════════════════════════════════════════════════════════════════
-- LADRIS Migration 014 — Live Datasource Sync Engine
-- Creates live_sync_jobs and project_change_log tables.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Live Sync Jobs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_sync_jobs (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Linked LADRIS project
    project_id               UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- External datasource identity
    source_type              VARCHAR(30) NOT NULL CHECK (source_type IN ('REST_API', 'DATABASE')),
    source_label             VARCHAR(255),               -- human-readable name e.g. "BhoomiRashi Prod"

    -- Connection credentials (encrypted via Fernet before storage)
    connection_url_encrypted TEXT NOT NULL,              -- encrypted endpoint or jdbc url
    api_key_encrypted        TEXT,                       -- encrypted API key (REST_API only)
    db_table_name            VARCHAR(255),               -- table/view name (DATABASE only)

    -- External→LADRIS project ID mapping
    ext_project_id           VARCHAR(255) NOT NULL,      -- the ID/code in the external system
    ext_id_field             VARCHAR(100) DEFAULT 'id',  -- column name in external system that holds ext_project_id

    -- Field mapping (external column → LADRIS canonical field)
    column_mapping           JSONB NOT NULL DEFAULT '{}',

    -- Scheduling
    sync_interval_mins       INTEGER NOT NULL DEFAULT 60 CHECK (sync_interval_mins >= 1),
    is_active                BOOLEAN NOT NULL DEFAULT TRUE,

    -- Sync state
    last_polled_at           TIMESTAMPTZ,
    last_successful_sync_at  TIMESTAMPTZ,
    last_data_hash           VARCHAR(64),                -- MD5 hex of last fetched payload
    last_payload_snapshot    JSONB,                      -- last raw payload for delta reference

    -- Error tracking
    consecutive_failures     INTEGER NOT NULL DEFAULT 0,
    last_error               TEXT,

    -- Webhook support
    webhook_secret           VARCHAR(128),               -- HMAC secret for verifying incoming webhooks

    -- Metadata
    created_by               UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index: only scan active jobs when polling
CREATE INDEX IF NOT EXISTS idx_live_sync_jobs_due
    ON live_sync_jobs (last_polled_at NULLS FIRST)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_live_sync_jobs_project
    ON live_sync_jobs (project_id);

-- ─── 2. Project Change Log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_change_log (
    id               BIGSERIAL PRIMARY KEY,

    project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sync_job_id      UUID REFERENCES live_sync_jobs(id) ON DELETE SET NULL,

    -- Who/what caused the change
    changed_by       VARCHAR(50) NOT NULL DEFAULT 'LIVE_SYNC'
                         CHECK (changed_by IN ('LIVE_SYNC', 'USER_EDIT', 'INGESTION', 'WEBHOOK', 'SYSTEM')),

    -- Delta details
    field_name       VARCHAR(150) NOT NULL,
    old_value        TEXT,
    new_value        TEXT,

    -- ML pipeline link
    ml_triggered     BOOLEAN NOT NULL DEFAULT FALSE,
    ml_prediction_id UUID REFERENCES ml_predictions(id) ON DELETE SET NULL,

    changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_log_project
    ON project_change_log (project_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_log_sync_job
    ON project_change_log (sync_job_id);

-- ─── 3. Auto-update updated_at on live_sync_jobs ─────────────────────────────
CREATE OR REPLACE FUNCTION update_live_sync_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_sync_jobs_updated_at ON live_sync_jobs;
CREATE TRIGGER trg_live_sync_jobs_updated_at
    BEFORE UPDATE ON live_sync_jobs
    FOR EACH ROW EXECUTE FUNCTION update_live_sync_jobs_updated_at();
