"""
LADRIS — Phase 7 Decision Intelligence API Tests
======================================================
Tests for FastAPI endpoints under /api/v1/intelligence/:
  1. GET  /api/v1/intelligence/risk-dna/{id}
  2. GET  /api/v1/intelligence/risk-history/{id}
  3. GET  /api/v1/intelligence/bottlenecks
  4. GET  /api/v1/intelligence/bottlenecks/{state_code}
  5. GET  /api/v1/intelligence/comparable-projects/{id}
  6. GET  /api/v1/intelligence/priority-queue
  7. POST /api/v1/intelligence/resource-scenario
"""

import sys
from pathlib import Path

# Add backend root to sys.path
BACKEND_DIR = Path(__file__).parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_intelligence_endpoints_auth_protection():
    """Verify all intelligence endpoints require authentication (return 401 when unauthenticated)."""
    r1 = client.get("/api/v1/intelligence/bottlenecks")
    assert r1.status_code == 401

    r2 = client.get("/api/v1/intelligence/priority-queue")
    assert r2.status_code == 401

    r3 = client.get("/api/v1/intelligence/gis-heatmap")
    assert r3.status_code == 401

    r4 = client.get("/api/v1/intelligence/risk-dna/a0000000-0000-0000-0000-000000000001")
    assert r4.status_code == 401

    r5 = client.get("/api/v1/intelligence/risk-history/a0000000-0000-0000-0000-000000000001")
    assert r5.status_code == 401

    r6 = client.get("/api/v1/intelligence/comparable-projects/a0000000-0000-0000-0000-000000000001")
    assert r6.status_code == 401
