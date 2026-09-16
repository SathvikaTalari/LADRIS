-- Migration 012: Decision Intelligence Module
-- Creates project_interventions table for official actions and impact tracking

CREATE TABLE IF NOT EXISTS project_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    intervention_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    action_taken_by VARCHAR(255),
    action_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Risk Before
    risk_score_before DOUBLE PRECISION NOT NULL,
    risk_category_before VARCHAR(20) NOT NULL,
    predicted_delay_before DOUBLE PRECISION,
    
    -- Risk After
    risk_score_after DOUBLE PRECISION NOT NULL,
    risk_category_after VARCHAR(20) NOT NULL,
    predicted_delay_after DOUBLE PRECISION,
    
    -- Improvements
    risk_score_reduction DOUBLE PRECISION,
    delay_reduction_days DOUBLE PRECISION,
    status_improved BOOLEAN DEFAULT FALSE,
    
    -- Model & Execution Metadata
    model_version VARCHAR(50) NOT NULL,
    prediction_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_project_interventions_project_date 
    ON project_interventions(project_id, action_date DESC);
CREATE INDEX IF NOT EXISTS ix_project_interventions_type 
    ON project_interventions(intervention_type);
