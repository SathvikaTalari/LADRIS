"""Production prediction API compatibility tests.

The former tests asserted that supervised delay prediction was deferred. That
prototype contract was retired when the existing calibrated LightGBM bundle
became the application's prediction source of truth.
"""
from app.main import app
from app.services.production_ml_service import _runtime


def test_model_bundle_contract():
    info = _runtime().model_info()
    assert len(info["feature_columns"]) == 23
    assert info["model_version"]
    assert "cross_validation" in info["evaluation"]


def test_prediction_compatibility_routes_use_current_contract():
    paths = app.openapi()["paths"]
    assert "/api/v1/predictions/{project_id}" in paths
    assert "/api/v1/predictions/{project_id}/stages" in paths
    assert "/api/v1/predictions/{project_id}/explanation" in paths
    assert "/api/v1/predictions/{project_id}/confidence" in paths
    assert "/api/v1/models/current" in paths
    assert "/api/v1/models/metrics" in paths


def test_production_prediction_routes():
    paths = app.openapi()["paths"]
    assert "/api/ml/predict/{project_id}" in paths
    assert "/api/ml/prediction/{project_id}" in paths
    assert "/api/ml/high-risk" in paths

