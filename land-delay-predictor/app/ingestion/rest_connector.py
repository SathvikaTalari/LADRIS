"""
REST API connector. Generic by design: a new government/agency API source is
onboarded by writing a YAML config (see config/sources/example_rest.yaml), not
by writing new code. Handles bearer/API-key auth and offset or page-token
pagination, which covers the great majority of REST-style govt data APIs.
"""
from __future__ import annotations

import requests
from sqlalchemy.orm import Session

from app.ingestion.base import (
    finish_ingestion_log,
    get_or_create_source,
    load_source_config,
    stage_records,
    start_ingestion_log,
)


def _build_headers(auth_cfg: dict) -> dict:
    headers = {}
    auth_type = auth_cfg.get("type")
    if auth_type == "bearer":
        headers["Authorization"] = f"Bearer {auth_cfg['token']}"
    elif auth_type == "api_key":
        headers[auth_cfg.get("header_name", "X-API-Key")] = auth_cfg["key"]
    return headers


def pull_rest_source(session: Session, config_path: str, triggered_by: str = "scheduler") -> None:
    config = load_source_config(config_path)
    source = get_or_create_source(
        session, name=config["source_name"], connector_type="rest_api", config_path=config_path
    )
    log = start_ingestion_log(session, source.id, triggered_by)

    headers = _build_headers(config.get("auth", {}))
    base_url = config["base_url"]
    records_field = config.get("records_field", "results")  # JSON key holding the list
    pagination = config.get("pagination", {"type": "none"})

    all_records: list[dict] = []
    try:
        if pagination["type"] == "offset":
            page_size = pagination.get("page_size", 100)
            offset = 0
            while True:
                params = {pagination.get("offset_param", "offset"): offset,
                          pagination.get("limit_param", "limit"): page_size}
                params.update(config.get("static_params", {}))
                resp = requests.get(base_url, headers=headers, params=params, timeout=30)
                resp.raise_for_status()
                body = resp.json()
                batch = body.get(records_field, []) if isinstance(body, dict) else body
                if not batch:
                    break
                all_records.extend(batch)
                offset += page_size
                if len(batch) < page_size:
                    break
        else:
            resp = requests.get(base_url, headers=headers, params=config.get("static_params", {}), timeout=30)
            resp.raise_for_status()
            body = resp.json()
            all_records = body.get(records_field, []) if isinstance(body, dict) else body

        staged = stage_records(session, source.id, log.id, all_records)
        finish_ingestion_log(session, log, records_pulled=len(all_records), records_staged=staged)

    except Exception as exc:  # noqa: BLE001 - surfaced via ingestion log, not raised silently
        finish_ingestion_log(
            session, log, records_pulled=len(all_records), records_staged=0,
            status="failed", error_detail=str(exc),
        )
        raise
