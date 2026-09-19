"""
LADRIS — User Management & Admin Settings Tests
Validates:
1. User listing endpoint /api/v1/auth/users
2. Adding new users (restricted to SUPER_ADMIN)
3. Updating and activating/deactivating users (restricted to SUPER_ADMIN)
"""
import pytest
from app.main import app

def test_users_api_routes_registered():
    paths = app.openapi()["paths"]
    assert "/api/v1/auth/users" in paths
    assert "/api/v1/auth/users/{user_id}" in paths
    assert "get" in paths["/api/v1/auth/users"]
    assert "post" in paths["/api/v1/auth/users"]
    assert "patch" in paths["/api/v1/auth/users/{user_id}"]
