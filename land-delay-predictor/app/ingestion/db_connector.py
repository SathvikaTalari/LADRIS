"""
Database connector. For sources where an agency grants authorized, read-only
DB access instead of an API. Runs a configured SELECT (never a write) and
stages each row. Connection profiles are per-source config, kept out of code
(pull from env/secrets manager in production — this is a scaffold).
"""
from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.ingestion.base import (
    finish_ingestion_log,
    get_or_create_source,
    load_source_config,
    stage_records,
    start_ingestion_log,
)


def pull_db_source(session: Session, config_path: str, triggered_by: str = "scheduler") -> None:
    config = load_source_config(config_path)
    source = get_or_create_source(
        session, name=config["source_name"], connector_type="database", config_path=config_path
    )
    log = start_ingestion_log(session, source.id, triggered_by)

    records: list[dict] = []
    try:
        # Read-only connection string for the source system, e.g.
        # "postgresql+psycopg2://readonly_user:***@agency-host:5432/agency_db"
        source_engine = create_engine(config["connection_string"], future=True)
        query = config["query"]  # e.g. "SELECT * FROM land_projects WHERE updated_at > :since"
        params = config.get("query_params", {})

        with source_engine.connect() as conn:
            result = conn.execute(text(query), params)
            columns = result.keys()
            records = [dict(zip(columns, row)) for row in result.fetchall()]

        staged = stage_records(session, source.id, log.id, records)
        finish_ingestion_log(session, log, records_pulled=len(records), records_staged=staged)

    except Exception as exc:  # noqa: BLE001
        finish_ingestion_log(
            session, log, records_pulled=len(records), records_staged=0,
            status="failed", error_detail=str(exc),
        )
        raise
