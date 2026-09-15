ALTER TABLE rr_records ADD COLUMN IF NOT EXISTS resettlement_site_ready BOOLEAN;

CREATE TABLE IF NOT EXISTS stakeholder_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    stakeholder_role VARCHAR(100),
    update_date TIMESTAMPTZ NOT NULL,
    update_type VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_stakeholder_updates_project_date ON stakeholder_updates(project_id, update_date);
CREATE INDEX IF NOT EXISTS ix_compensation_records_project_date ON compensation_records(project_id, disbursement_date);
CREATE INDEX IF NOT EXISTS ix_legal_cases_project_dates ON legal_cases(project_id, filing_date, resolution_date);
