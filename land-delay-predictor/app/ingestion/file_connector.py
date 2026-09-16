"""
CSV/XLSX ingestion. This is the highest-volume real path early on: most state
portals and agencies can produce an export even when they have no API. Used by
both the scheduled "official export drop" flow and the manual upload endpoint
(app/api/main.py) — the only difference between them is `triggered_by`.
"""
from __future__ import annotations

import pandas as pd
from sqlalchemy.orm import Session

from app.ingestion.base import (
    finish_ingestion_log,
    get_or_create_source,
    load_source_config,
    stage_records,
    start_ingestion_log,
)


def pull_file_source(
    session: Session,
    file_path: str,
    source_name: str,
    config_path: str | None = None,
    triggered_by: str = "manual",
) -> None:
    source = get_or_create_source(
        session, name=source_name, connector_type="file", config_path=config_path
    )
    log = start_ingestion_log(session, source.id, triggered_by)

    records: list[dict] = []
    try:
        if file_path.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(file_path)
        else:
            df = pd.read_csv(file_path)

        # Basic hygiene before staging: drop fully-empty rows, normalize column names
        df = df.dropna(how="all")
        df.columns = [str(c).strip() for c in df.columns]
        records = df.to_dict(orient="records")

        staged = stage_records(session, source.id, log.id, records)
        finish_ingestion_log(session, log, records_pulled=len(records), records_staged=staged)

    except Exception as exc:  # noqa: BLE001
        finish_ingestion_log(
            session, log, records_pulled=len(records), records_staged=0,
            status="failed", error_detail=str(exc),
        )
        raise
