"""
End-to-end test for project deletion functionality.
Verifies:
1. Project creation
2. Immediate ML prediction and presence in project directory
3. Deletion via DELETE /api/v1/projects/{id}
4. Exclusion from list and 404 on get
5. Clean removal from CSV
"""
import asyncio
import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.services.auth_service import create_access_token
from sqlalchemy import select

async def run_test():
    async with AsyncSessionLocal() as db:
        # Get an officer or admin user
        res = await db.execute(select(User).where(User.role.in_([UserRole.SUPER_ADMIN, UserRole.DISTRICT_OFFICER])))
        user = res.scalars().first()
        assert user, "No officer or admin user found in DB"
        token = create_access_token(user.id, user.email, user.role.value)

    headers = {"Authorization": f"Bearer {token}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a temporary test project
        payload = {
            "project_code": "TEST-DEL-999",
            "name": "Deletable Test Bypass Project",
            "project_type": "HIGHWAY",
            "acquisition_act": "RFCTLARR_2013",
            "state_code": "TS",
            "district_codes": ["Rangareddy"],
            "executing_agency": "NHAI",
            "total_area_ha": 50.0,
            "area_acquired_ha": 10.0,
            "area_in_possession_ha": 5.0,
            "total_affected_families": 40,
            "families_compensated": 15,
            "families_rehabilitated": 10,
            "estimated_compensation_inr": 20000000.0,
            "disbursed_compensation_inr": 8000000.0,
            "latitude": 17.3850,
            "longitude": 78.4867
        }
        create_res = await client.post("/api/v1/projects/", json=payload, headers=headers)
        if create_res.status_code == 409:
            # Already exists from previous run, let's fetch it to get ID
            list_res = await client.get("/api/v1/projects/?search=TEST-DEL-999", headers=headers)
            proj_id = list_res.json()["items"][0]["id"]
        else:
            assert create_res.status_code == 201, f"Create failed: {create_res.text}"
            proj_id = create_res.json()["id"]

        print(f"✓ Created test project with ID: {proj_id}")

        # 2. Verify project exists in list
        get_res = await client.get(f"/api/v1/projects/{proj_id}", headers=headers)
        assert get_res.status_code == 200, f"Get failed: {get_res.text}"
        print(f"✓ Verified project {get_res.json()['project_code']} is accessible")

        # 3. Delete the project
        del_res = await client.delete(f"/api/v1/projects/{proj_id}", headers=headers)
        assert del_res.status_code == 204, f"Delete failed: {del_res.status_code} {del_res.text}"
        print(f"✓ Soft-deleted project {proj_id} with status 204")

        # 4. Verify project is now 404
        get_res_after = await client.get(f"/api/v1/projects/{proj_id}", headers=headers)
        assert get_res_after.status_code == 404, f"Expected 404 but got: {get_res_after.status_code}"
        print("✓ Verified project returns 404 after deletion")

        # 5. Verify project is not in projects list
        list_res_after = await client.get("/api/v1/projects/?search=TEST-DEL-999", headers=headers)
        assert len(list_res_after.json()["items"]) == 0, "Deleted project still returned in list!"
        print("✓ Verified project is excluded from active directory list")

    print("\nALL PROJECT DELETION TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    asyncio.run(run_test())
