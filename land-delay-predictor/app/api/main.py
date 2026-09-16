"""
API surface for the ingestion gateway and model pipeline.

Endpoints map directly onto the six integration methods described in the
problem statement, plus model/training/prediction endpoints, dashboard
visualization, alerting, GIS, and continuous learning.
"""
from __future__ import annotations

import os
import shutil
import tempfile
import time
from typing import Any

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.init_db import SessionLocal
from app.db.schema import IngestionSource, Project, RiskScore
from app.etl.pipeline import promote_all_sources, promote_source_records
from app.ingestion.base import get_or_create_source
from app.ingestion.db_connector import pull_db_source
from app.ingestion.file_connector import pull_file_source
from app.ingestion.rest_connector import pull_rest_source
from app.ingestion.webhook_connector import stage_webhook_event
from app.ml.alerts import generate_alerts, get_alert_summary, check_alerts_for_project
from app.ml.continuous_learning import (
    get_training_history, get_latest_evaluation, run_continuous_training, should_retrain,
)
from app.ml.evaluation import run_full_evaluation, print_evaluation_report
from app.ml.predict import score_all_projects
from app.ml.stage_predictor import get_stage_risk_summary, predict_stage_risks
from app.ml.train import run_training
from app.ml import get_latest_evaluation as _get_latest_eval
from app.ml.predict import get_global_shap_summary

app = FastAPI(title="Land Acquisition Delay Predictor")

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time-Ms"] = str(round(process_time * 1000, 2))
    return response

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_uploader(x_uploader_id: str | None = Header(default=None)) -> str:
    """Minimal auth stand-in for manual uploads."""
    if not x_uploader_id:
        raise HTTPException(status_code=401, detail="X-Uploader-Id header required for manual uploads")
    return x_uploader_id


# ── Ingestion Endpoints ──────────────────────────────────────────────────────

@app.post("/ingest/file")
def ingest_file(source_name: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        pull_file_source(db, tmp_path, source_name=source_name, triggered_by="file_upload")
    finally:
        os.unlink(tmp_path)
    return {"status": "staged", "source": source_name}


@app.post("/ingest/manual")
def ingest_manual(
    source_name: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    uploader_id: str = Depends(require_uploader),
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        pull_file_source(db, tmp_path, source_name=source_name, triggered_by=f"manual_upload:{uploader_id}")
    finally:
        os.unlink(tmp_path)
    return {"status": "staged", "source": source_name, "uploaded_by": uploader_id}


@app.post("/webhooks/{source_name}")
def receive_webhook(source_name: str, payload: dict, db: Session = Depends(get_db)):
    source = get_or_create_source(db, name=source_name, connector_type="webhook")
    record_id = stage_webhook_event(db, source.id, payload)
    return {"status": "staged_pending_verification", "record_id": record_id}


@app.post("/ingestion/pull/{source_name}")
def trigger_pull(source_name: str, db: Session = Depends(get_db)):
    source = db.query(IngestionSource).filter_by(name=source_name).first()
    if not source:
        raise HTTPException(status_code=404, detail=f"Unknown source: {source_name}")
    if source.connector_type == "rest_api":
        pull_rest_source(db, source.config_path, triggered_by="manual_trigger")
    elif source.connector_type == "database":
        pull_db_source(db, source.config_path, triggered_by="manual_trigger")
    else:
        raise HTTPException(status_code=400, detail=f"{source.connector_type} sources aren't pulled on-demand here")
    return {"status": "pulled", "source": source_name}


@app.post("/etl/run")
def run_etl(source_name: str | None = None, db: Session = Depends(get_db)):
    if source_name:
        source = db.query(IngestionSource).filter_by(name=source_name).first()
        if not source:
            raise HTTPException(status_code=404, detail=f"Unknown source: {source_name}")
        return promote_source_records(db, source.id, source.config_path)
    return promote_all_sources(db)


# ── Model Training & Prediction ──────────────────────────────────────────────

@app.post("/model/train")
def train_model():
    return run_training()


@app.post("/model/predict")
def predict(db: Session = Depends(get_db)):
    scores = score_all_projects(db)
    return {"scored_projects": len(scores)}


@app.post("/model/evaluate")
def evaluate_model(db: Session = Depends(get_db)):
    """Run full model evaluation and save results with model version."""
    metadata = run_full_evaluation()
    report = print_evaluation_report(metadata)
    return {"evaluation_report": report, "version": metadata["version"]}


@app.post("/model/retrain")
def retrain_model(db: Session = Depends(get_db)):
    """Automated continuous learning: checks triggers and retrains if needed."""
    return run_continuous_training()


@app.get("/model/global-shap")
def global_shap(version: str | None = None, db: Session = Depends(get_db)):
    """Get global SHAP feature importances for a model version."""
    return get_global_shap_summary(db, version)


# ── Project Risk & Stage Prediction ──────────────────────────────────────────

@app.get("/projects/{project_id}/risk")
def get_project_risk(project_id: str, db: Session = Depends(get_db)):
    latest = (
        db.query(RiskScore)
        .filter_by(project_id=project_id)
        .order_by(RiskScore.predicted_at.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No risk score for this project yet")
    return {
        "project_id": project_id,
        "risk_score": latest.risk_score,
        "risk_category": latest.risk_category,
        "predicted_delay_days": latest.predicted_delay_days,
        "top_drivers": latest.top_drivers_json,
        "recommendations": latest.recommendations_json,
        "model_version": latest.model_version,
    }


@app.get("/projects/{project_id}/alerts")
def get_project_alerts(project_id: str, db: Session = Depends(get_db)):
    return check_alerts_for_project(db, project_id)


@app.get("/stage-risks")
def get_stage_risks(db: Session = Depends(get_db)):
    """Per-project, per-lifecycle-stage risk scores."""
    summary = get_stage_risk_summary(db)
    return summary


# ── Dashboard & Visualization ────────────────────────────────────────────────

@app.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    """High-level dashboard data: risk distribution, counts, alerts."""
    projects = db.query(Project).all()
    risk_scores = db.query(RiskScore).order_by(RiskScore.predicted_at.desc()).all()

    high_risk = [r for r in risk_scores if r.risk_category.value == "high"]
    medium_risk = [r for r in risk_scores if r.risk_category.value == "medium"]
    low_risk = [r for r in risk_scores if r.risk_category.value == "low"]

    avg_score = sum(float(r.risk_score) for r in risk_scores) / len(risk_scores) if risk_scores else 0

    state_trends = {}
    district_trends = {}
    for p in projects:
        if p.state:
            state_trends.setdefault(p.state, {"count": 0, "delayed": 0})
            state_trends[p.state]["count"] += 1
            if p.is_delayed:
                state_trends[p.state]["delayed"] += 1
        if p.district:
            district_trends.setdefault(p.district, {"count": 0, "delayed": 0})
            district_trends[p.district]["count"] += 1
            if p.is_delayed:
                district_trends[p.district]["delayed"] += 1

    return {
        "total_projects": len(projects),
        "high_risk_count": len(high_risk),
        "medium_risk_count": len(medium_risk),
        "low_risk_count": len(low_risk),
        "avg_risk_score": round(avg_score, 2),
        "risk_distribution": {
            "high": len(high_risk),
            "medium": len(medium_risk),
            "low": len(low_risk),
        },
        "state_trends": state_trends,
        "district_trends": district_trends,
    }


@app.get("/dashboard/trends")
def delay_trends(db: Session = Depends(get_db)):
    """District-wise and state-wise delay trends."""
    projects = db.query(Project).all()

    state_data = {}
    for p in projects:
        if not p.state:
            continue
        if p.state not in state_data:
            state_data[p.state] = {
                "total": 0, "delayed": 0, "avg_delay_days": [],
                "high_risk": 0, "on_track": 0,
            }
        state_data[p.state]["total"] += 1
        if p.is_delayed:
            state_data[p.state]["delayed"] += 1
            if p.delay_days:
                state_data[p.state]["avg_delay_days"].append(p.delay_days)

    district_data = {}
    for p in projects:
        if not p.district:
            continue
        if p.district not in district_data:
            district_data[p.district] = {
                "total": 0, "delayed": 0, "avg_delay_days": [],
                "state": p.state, "high_risk": 0, "on_track": 0,
            }
        district_data[p.district]["total"] += 1
        if p.is_delayed:
            district_data[p.district]["delayed"] += 1
            if p.delay_days:
                district_data[p.district]["avg_delay_days"].append(p.delay_days)

    for data in state_data.values():
        data["delay_rate"] = round(data["delayed"] / data["total"], 4) if data["total"] else 0
        data["avg_delay_days"] = round(sum(data["avg_delay_days"]) / len(data["avg_delay_days"]), 1) if data["avg_delay_days"] else None

    for data in district_data.values():
        data["delay_rate"] = round(data["delayed"] / data["total"], 4) if data["total"] else 0
        data["avg_delay_days"] = round(sum(data["avg_delay_days"]) / len(data["avg_delay_days"]), 1) if data["avg_delay_days"] else None

    return {"state_trends": state_data, "district_trends": district_data}


@app.get("/dashboard/gis-projects")
def gis_projects(db: Session = Depends(get_db)):
    """GIS-ready project data for map visualization."""
    projects = db.query(Project).all()
    gis_data = []
    for p in projects:
        gis_data.append({
            "project_id": p.id,
            "project_name": p.project_name,
            "project_type": p.project_type,
            "state": p.state,
            "district": p.district,
            "land_area_hectares": p.land_area_hectares,
            "affected_families_count": p.affected_families_count,
            "current_stage": p.current_stage.value if p.current_stage else None,
            "is_delayed": p.is_delayed,
            "geometry": p.geom,
            "risk_score": (
                db.query(RiskScore)
                .filter_by(project_id=p.id)
                .order_by(RiskScore.predicted_at.desc())
                .first()
                .risk_score
                if db.query(RiskScore).filter_by(project_id=p.id).first()
                else None
            ),
        })
    return {"projects": gis_data, "count": len(gis_data)}


# ── Alerts & Decision Support ────────────────────────────────────────────────

@app.get("/alerts/summary")
def alerts_summary(db: Session = Depends(get_db)):
    return get_alert_summary(db)


@app.get("/alerts/all")
def all_alerts(db: Session = Depends(get_db)):
    return generate_alerts(db)


@app.get("/alerts/threshold/{threshold}")
def alerts_by_threshold(threshold: float, db: Session = Depends(get_db)):
    return generate_alerts(db, risk_threshold=threshold)


# ── Continuous Learning & Model Metadata ─────────────────────────────────────

@app.get("/model/status")
def model_status():
    """Check if retraining is needed."""
    return should_retrain()


@app.get("/model/versions")
def model_versions():
    """List all saved model versions."""
    return get_training_history()


@app.get("/model/latest-evaluation")
def latest_evaluation():
    """Get the latest model evaluation metrics."""
    return get_latest_evaluation()


@app.get("/model/latest-evaluation-report")
def latest_evaluation_report():
    """Get a human-readable evaluation report."""
    eval_data = get_latest_evaluation()
    if not eval_data:
        raise HTTPException(status_code=404, detail="No evaluation data found. Train a model first.")
    return {"report": print_evaluation_report(eval_data)}
