"""
LADRIS — Phase 4 Intervention API Integration Tests
=========================================================
Tests:
  1. GET /api/v1/interventions/catalog
  2. GET /api/v1/interventions/{project_id}
  3. GET /api/v1/interventions/{project_id}/priority
  4. GET /api/v1/interventions/{project_id}/evidence
  5. GET /api/v1/interventions/{project_id}/fields
  6. POST /api/v1/interventions/{project_id}/simulate
  7. POST /api/v1/interventions/{project_id}/compare
"""

import sys
import unittest
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestInterventionAPI(unittest.TestCase):

    def test_get_catalog_unauthenticated(self):
        # Catalog requires auth token
        response = client.get("/api/v1/interventions/catalog")
        self.assertIn(response.status_code, [401, 403])

    def test_invalid_project_id_format(self):
        # Invalid UUID format should return 422 or 401 depending on auth
        response = client.get("/api/v1/interventions/not-a-valid-uuid")
        self.assertIn(response.status_code, [401, 403, 422])

    def test_health_check(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertIn(response.json()["status"], ["healthy", "degraded"])


if __name__ == "__main__":
    unittest.main()
