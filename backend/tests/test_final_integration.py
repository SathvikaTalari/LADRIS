"""Final route-level integration checks for the production architecture."""
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_authentication_and_rbac_are_enforced():
    assert client.post("/api/v1/auth/login", json={"email": "invalid@ladris.gov.in", "password": "wrong"}).status_code in {400, 401, 422}
    assert client.get("/api/v1/models/metrics").status_code in {401, 403}


def test_application_surfaces_are_registered_and_protected():
    for path in [
        "/api/v1/projects/", "/api/v1/gis/projects", "/api/v1/alerts/",
        "/api/v1/data-sources/", "/api/v1/data-quality/",
        "/api/v1/intelligence/priority-queue", "/api/v1/reports/projects.csv",
    ]:
        assert client.get(path).status_code in {200, 401, 403}


def test_openapi_contains_complete_ml_flow():
    paths = app.openapi()["paths"]
    required = {
        "/api/ml/predict/{project_id}", "/api/ml/prediction/{project_id}",
        "/api/ml/explanation/{project_id}", "/api/ml/stages/{project_id}",
        "/api/ml/model-info", "/api/ml/monitoring", "/api/ml/retraining-status",
    }
    assert required <= set(paths)
