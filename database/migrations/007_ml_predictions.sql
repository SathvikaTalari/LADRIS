CREATE TABLE IF NOT EXISTS ml_predictions (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    snapshot_date TIMESTAMPTZ NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    feature_snapshot JSONB NOT NULL,
    delay_probability DOUBLE PRECISION NOT NULL CHECK (delay_probability BETWEEN 0 AND 1),
    risk_score DOUBLE PRECISION NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    risk_category VARCHAR(10) NOT NULL CHECK (risk_category IN ('LOW','MEDIUM','HIGH')),
    predicted_delay_days DOUBLE PRECISION,
    prediction_interval JSONB NOT NULL DEFAULT '{}'::jsonb,
    stage_predictions JSONB NOT NULL DEFAULT '[]'::jsonb,
    top_drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    validation JSONB NOT NULL DEFAULT '{}'::jsonb,
    latency_ms DOUBLE PRECISION,
    predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_ml_predictions_project_predicted ON ml_predictions(project_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS ix_ml_predictions_category ON ml_predictions(risk_category);
