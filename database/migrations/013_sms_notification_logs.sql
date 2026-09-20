-- Migration 013: Add phone_number to users and create notification_logs table for alert notifications

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

CREATE TABLE IF NOT EXISTS notification_logs (
    id BIGSERIAL PRIMARY KEY,
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    channel VARCHAR(10) NOT NULL,
    recipient VARCHAR(255),
    status VARCHAR(10) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_msg TEXT
);

CREATE INDEX IF NOT EXISTS ix_notification_logs_alert_id ON notification_logs(alert_id);
