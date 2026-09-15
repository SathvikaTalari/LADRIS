"""Contract tests for the production LightGBM integration."""
from datetime import date, datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import os
import sys

import pytest

from app.models.project import ProjectType
from app.models.stage import StageName, StageStatus
from app.services.ml_feature_service import build_features, validate_project_consistency
from app.services.project_csv_service import read_raw_projects


def project(**overrides):
    values = dict(
        id="p1", project_type=ProjectType.HIGHWAY, state_code="MH", district_codes=["Nagpur"],
        executing_agency="NHAI", nodal_agency=None, total_area_ha=100,
        total_affected_families=200, families_compensated=100, families_rehabilitated=50,
        planned_start_date=date(2024, 1, 1), planned_end_date=date(2026, 1, 1),
        actual_end_date=None, notification_3a_date=date(2024, 1, 1), notification_3d_date=date(2024, 2, 1),
        estimated_compensation_inr=1_000_000, disbursed_compensation_inr=500_000,
        legal_case_count=2, legal_case_status="OPEN", stages=[], deleted_at=None,
    )
    values.update(overrides)
    return SimpleNamespace(**values)


def test_database_to_feature_mapping_and_calculations():
    stage = SimpleNamespace(stage_name=StageName.COMPENSATION_DISBURSEMENT, stage_order=8, status=StageStatus.IN_PROGRESS, actual_start_date=date(2025, 1, 1))
    target = project(stages=[stage])
    completed = project(id="old", actual_end_date=date(2025, 2, 1), planned_end_date=date(2025, 1, 1))
    features, unavailable = build_features(target, [target, completed], datetime(2025, 9, 1, tzinfo=timezone.utc))
    assert list(features) == EXPECTED_COLUMNS
    assert features["project_type"] == "highway"
    assert features["state"] == "Maharashtra"
    assert features["compensation_disbursement_pct"] == 50
    assert features["days_since_notification"] == 609
    assert features["current_stage"] == "compensation"
    assert features["district_historical_delay_rate"] == 1.0
    assert any("stakeholder" in item for item in unavailable)


def test_leakage_prevention_ignores_future_outcome():
    target = project()
    future = project(id="future", actual_end_date=date(2027, 2, 1), planned_end_date=date(2026, 1, 1))
    features, _ = build_features(target, [target, future], datetime(2025, 9, 1, tzinfo=timezone.utc))
    assert features["district_historical_delay_rate"] is None
    assert "actual_end_date" not in features
    assert "delay_months" not in features


def test_raw_event_records_feed_training_equivalent_features():
    snapshot = datetime(2025, 9, 1, tzinfo=timezone.utc)
    target = project()
    target._ml_compensation_records = [SimpleNamespace(
        created_at=date(2025, 1, 1), awarded_amount_inr=1_000_000,
        disbursed_amount_inr=600_000, disbursement_date=date(2025, 8, 22),
    )]
    target._ml_legal_cases = [
        SimpleNamespace(created_at=date(2025, 1, 1), filing_date=date(2025, 6, 1), resolution_date=None),
        SimpleNamespace(created_at=date(2025, 1, 1), filing_date=date(2025, 1, 1), resolution_date=date(2025, 7, 1)),
    ]
    target._ml_rehabilitation_records = [SimpleNamespace(
        updated_at=datetime(2025, 8, 1, tzinfo=timezone.utc),
        total_families_to_rehabilitate=100, families_relocated=75,
        resettlement_site_ready=True,
    )]
    target._ml_stakeholder_updates = [
        SimpleNamespace(update_date=datetime(2025, 8, 1, tzinfo=timezone.utc)),
        SimpleNamespace(update_date=datetime(2025, 8, 21, tzinfo=timezone.utc)),
    ]
    features, unavailable = build_features(target, [target], snapshot)
    assert features["compensation_disbursement_pct"] == 60
    assert features["days_since_last_disbursement"] == 10
    assert features["legal_dispute_count"] == 2
    assert features["open_legal_dispute_count"] == 1
    assert features["max_dispute_pendency_days"] == 92
    assert features["rehabilitation_progress_pct"] == 75
    assert features["resettlement_site_ready"] is True
    assert features["stakeholder_update_count_90d"] == 2
    assert features["avg_days_between_updates"] == 20
    assert not unavailable


def test_invalid_project_consistency_rejected():
    invalid = project(disbursed_compensation_inr=2_000_000, families_rehabilitated=201)
    errors = validate_project_consistency(invalid)
    assert len(errors) == 2


EXPECTED_COLUMNS = [
    "project_type", "state", "district", "implementing_agency", "land_area_hectares",
    "affected_families_count", "days_since_notification", "days_to_expected_completion",
    "compensation_sanctioned", "compensation_disbursed", "compensation_disbursement_pct",
    "days_since_last_disbursement", "legal_dispute_count", "open_legal_dispute_count",
    "max_dispute_pendency_days", "rehabilitation_progress_pct", "resettlement_site_ready",
    "stakeholder_update_count_90d", "avg_days_between_updates", "stage_count_recorded",
    "current_stage", "district_historical_delay_rate", "agency_historical_delay_rate",
]


def test_raw_project_csv_mapping_excludes_training_outcomes():
    root = Path(__file__).resolve().parents[2]
    rows = read_raw_projects(root / "land-delay-predictor" / "my_raw_projects.csv")
    assert rows
    by_code = {row["project_code"]: row for row in rows}
    assert len(by_code) == len(rows), "Project ID values must be unique"
    assert by_code["MY_PROJ_001"]["rehabilitation_progress_pct"] == 25
    assert by_code["MY_PROJ_001"]["legal_case_count"] == 5
    assert by_code["MY_PROJ_002"]["current_stage"] == "possession"
    for row in rows:
        assert "Actual Completion" not in row
        assert "Delayed (Y/N)" not in row
        assert "Delay (days)" not in row


@pytest.fixture(scope="module")
def inference():
    root = Path(__file__).resolve().parents[2]
    os.environ["MODELS_DIR"] = str(root / "land-delay-predictor" / "models")
    sys.path.insert(0, str(root / "land-delay-predictor" / "app"))
    from ml import inference as module
    return module


def representative(level: str):
    base = dict(
        project_type="highway", state="Maharashtra", district="Nagpur", implementing_agency="NHAI",
        land_area_hectares=100, affected_families_count=200, days_since_notification=300,
        days_to_expected_completion=100, compensation_sanctioned=1e8, compensation_disbursed=7e7,
        compensation_disbursement_pct=70, days_since_last_disbursement=20, legal_dispute_count=1,
        open_legal_dispute_count=0, max_dispute_pendency_days=0, rehabilitation_progress_pct=60,
        resettlement_site_ready=1, stakeholder_update_count_90d=5, avg_days_between_updates=15,
        stage_count_recorded=5, current_stage="compensation", district_historical_delay_rate=.3,
        agency_historical_delay_rate=.3,
    )
    if level == "low":
        base.update(compensation_disbursement_pct=100, compensation_disbursed=1e8, legal_dispute_count=0, rehabilitation_progress_pct=100, district_historical_delay_rate=.05, agency_historical_delay_rate=.05)
    elif level == "high":
        base.update(days_since_notification=1500, days_to_expected_completion=-300, compensation_disbursement_pct=5, compensation_disbursed=5e6, open_legal_dispute_count=8, legal_dispute_count=8, max_dispute_pendency_days=700, rehabilitation_progress_pct=5, resettlement_site_ready=0)
    return base


@pytest.mark.parametrize("profile", ["low", "medium", "high"])
def test_existing_model_end_to_end_profiles(inference, profile):
    result = inference.predict_features(representative(profile))
    assert result["model_version"] == "20260914_080620"
    assert 0 <= result["delay_probability"] <= 1
    assert result["risk_score"] == round(result["delay_probability"] * 100, 2)
    assert result["risk_category"] == profile.upper()
    assert set(result["prediction_interval"]) == {"p10", "p90"}
    assert result["top_drivers"]
    assert {"feature", "value", "contribution", "direction", "recommendation"} <= set(result["top_drivers"][0])


def test_categorical_and_invalid_input_handling(inference):
    cleaned, validation = inference.validate_single_row(representative("medium"), strict=True)
    assert validation.is_valid
    assert cleaned["current_stage"] == "compensation"
    invalid = representative("medium")
    invalid["open_legal_dispute_count"] = 2
    invalid["legal_dispute_count"] = 1
    with pytest.raises(ValueError):
        inference.predict_features(invalid)


def test_stage_predictions_use_production_model(inference):
    stages = inference.predict_stages(representative("medium"))
    assert len(stages) == 8
    assert {item["stage"] for item in stages} == {"notification", "survey", "approval", "compensation", "legal_resolution", "rehabilitation", "possession", "completed"}


def test_production_api_contract_is_registered():
    from app.main import app
    paths = app.openapi()["paths"]
    for path in [
        "/api/ml/predict/{project_id}", "/api/ml/prediction/{project_id}",
        "/api/ml/explanation/{project_id}", "/api/ml/stages/{project_id}",
        "/api/ml/high-risk", "/api/ml/model-info",
    ]:
        assert path in paths


@pytest.mark.asyncio
async def test_prediction_persistence_service(monkeypatch):
    import uuid
    from app.services import production_ml_service as service

    target = project(id=uuid.uuid4())
    class Runtime:
        def predict_features(self, features):
            return {"model_version": "test-v1", "delay_probability": .5, "risk_score": 50,
                    "risk_category": "MEDIUM", "predicted_delay_days": 10,
                    "prediction_interval": {"p10": 5, "p90": 20}, "top_drivers": [],
                    "recommendations": [], "validation": {"is_valid": True}, "latency_ms": 1.2}
        def predict_stages(self, features):
            return [{"stage": "notification", "risk_score": 50, "risk_category": "MEDIUM", "delay_probability": .5}]

    async def context(db, project_id):
        return target, [target]

    class DB:
        def __init__(self): self.saved = None
        def add(self, row): self.saved = row
        async def flush(self):
            self.saved.id = uuid.uuid4(); self.saved.predicted_at = datetime.now(timezone.utc)
        async def refresh(self, row): pass

    monkeypatch.setattr(service, "load_project_context", context)
    monkeypatch.setattr(service, "_runtime", lambda: Runtime())
    async def no_alert(db, project, result):
        return None
    monkeypatch.setattr(service, "sync_prediction_alert", no_alert)
    db = DB()
    result = await service.generate_prediction(db, target.id, datetime(2025, 9, 1, tzinfo=timezone.utc))
    assert db.saved.feature_snapshot
    assert result["prediction_status"] == "AVAILABLE"
    assert result["risk_score"] == 50


def test_frontend_uses_production_ml_api_without_risk_fallbacks():
    root = Path(__file__).resolve().parents[2]
    client = (root / "frontend" / "src" / "api" / "client.ts").read_text(encoding="utf-8")
    detail = (root / "frontend" / "src" / "pages" / "Projects" / "ProjectDetail.tsx").read_text(encoding="utf-8")
    assert "/api/ml/prediction/${projectId}" in client
    assert "/api/ml/predict/${projectId}" in client
    assert "prediction.risk_score" in detail
    assert "Risk score" in detail
    assert "Unavailable" in detail
    assert "Classification thresholds are loaded from model metadata" in detail
