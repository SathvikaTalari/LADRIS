"""Regression tests for production-only API and frontend surfaces."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.schemas.project import ProjectCreate
from app.services.production_ml_service import _runtime


def test_production_model_metadata_is_exposed():
    info = _runtime().model_info()
    assert info["model_type"] == "calibrated_lightgbm_classifier_and_quantile_regressors"
    assert len(info["feature_columns"]) == 23
    assert set(info["risk_thresholds"]) == {"low_medium", "medium_high"}
    assert info["evaluation"]["cross_validation"]["auc_roc"] > 0


def test_all_production_and_decision_routes_are_registered():
    paths = app.openapi()["paths"]
    expected = {
        "/api/ml/predict/{project_id}", "/api/ml/prediction/{project_id}",
        "/api/ml/explanation/{project_id}", "/api/ml/stages/{project_id}",
        "/api/ml/high-risk", "/api/ml/model-info", "/api/ml/monitoring",
        "/api/v1/intelligence/risk-dna/{project_id}",
        "/api/v1/intelligence/priority-queue", "/api/v1/intelligence/gis-heatmap",
        "/api/v1/data-quality/", "/api/v1/interventions/{project_id}/simulate",
    }
    assert expected <= set(paths)


def test_ml_routes_require_authentication():
    client = TestClient(app)
    assert client.get("/api/ml/model-info").status_code in {401, 403}
    assert client.get("/api/v1/intelligence/priority-queue").status_code in {401, 403}


def test_create_schema_rejects_impossible_raw_values():
    with pytest.raises(ValidationError):
        ProjectCreate(
            project_code="BAD-1", name="Invalid project", project_type="HIGHWAY",
            state_code="MH", estimated_compensation_inr=100,
            disbursed_compensation_inr=101,
        )
    with pytest.raises(ValidationError):
        ProjectCreate(
            project_code="BAD-2", name="Invalid dates", project_type="HIGHWAY",
            state_code="MH", planned_start_date="2026-02-01", planned_end_date="2026-01-01",
        )


def test_frontend_has_no_risk_level_score_lookup_or_demo_role_projects():
    root = Path(__file__).resolve().parents[2] / "frontend" / "src" / "pages"
    gis = (root / "GIS.tsx").read_text(encoding="utf-8")
    priority = (root / "PriorityIntelligence.tsx").read_text(encoding="utf-8")
    agency = (root / "AgencyPortal.tsx").read_text(encoding="utf-8")
    workbench = (root / "LAWorkbench.tsx").read_text(encoding="utf-8")
    assert "priorityMap" not in gis
    assert "score = 78.4" not in priority
    assert "NHAI-TG-765" not in agency
    assert "NH-765-P2" not in workbench


def test_alert_generation_uses_persisted_model_outputs_only():
    alerts = (Path(__file__).resolve().parents[1] / "app" / "api" / "v1" / "alerts.py").read_text(encoding="utf-8")
    assert "MLPrediction" in alerts
    assert '"prediction_source": "ml_predictions"' in alerts
    assert 'get("previous_score_7d", 57)' not in alerts
    assert '"critical_stage": "Compensation"' not in alerts
