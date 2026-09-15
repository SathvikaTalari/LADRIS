"""
Scheduled ingestion. Wraps REST/DB connectors (and, if configured, recurring
file drops from a watched directory) with periodic jobs. Each source declares
its own interval in its config so a fast-changing source and a monthly-export
source can coexist.

Run standalone with: python -m app.ingestion.scheduler
"""
from __future__ import annotations

import glob
import os

import yaml
from apscheduler.schedulers.blocking import BlockingScheduler

from app.db.init_db import SessionLocal
from app.ingestion.db_connector import pull_db_source
from app.ingestion.file_connector import pull_file_source
from app.ingestion.rest_connector import pull_rest_source

SOURCES_DIR = os.environ.get("SOURCES_CONFIG_DIR", "config/sources")


def _run_connector(config_path: str) -> None:
    with open(config_path) as f:
        config = yaml.safe_load(f)
    connector_type = config["connector_type"]

    session = SessionLocal()
    try:
        if connector_type == "rest_api":
            pull_rest_source(session, config_path, triggered_by="scheduler")
        elif connector_type == "database":
            pull_db_source(session, config_path, triggered_by="scheduler")
        elif connector_type == "file":
            # scheduled file connector watches a drop directory for new exports
            for file_path in glob.glob(config["watch_glob"]):
                pull_file_source(
                    session, file_path, source_name=config["source_name"],
                    config_path=config_path, triggered_by="scheduler",
                )
        else:
            raise ValueError(f"Unknown connector_type for scheduling: {connector_type}")
    finally:
        session.close()


def build_scheduler() -> BlockingScheduler:
    scheduler = BlockingScheduler()
    for config_path in glob.glob(os.path.join(SOURCES_DIR, "*.yaml")):
        with open(config_path) as f:
            config = yaml.safe_load(f)
        interval_minutes = config.get("schedule_interval_minutes")
        if not interval_minutes:
            continue  # source isn't set up for scheduled pulls
        scheduler.add_job(
            _run_connector, "interval", minutes=interval_minutes,
            args=[config_path], id=config["source_name"],
        )
    return scheduler


if __name__ == "__main__":
    build_scheduler().start()
