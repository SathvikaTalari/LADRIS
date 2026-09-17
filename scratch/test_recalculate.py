import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.project import Project
from app.services.auth_service import create_access_token
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.role == UserRole.SUPER_ADMIN))
        user = res.scalars().first()
        token = create_access_token(user.id, user.email, user.role.value)

        # Find project MANUAL-1789618841916 or any project
        proj_res = await db.execute(select(Project).where(Project.deleted_at.is_(None)).limit(1))
        project = proj_res.scalars().first()
        assert project, "No project found"
        proj_id = str(project.id)
        print(f"Testing on project: {project.project_code} ({project.name}), id={proj_id}")

    headers = {"Authorization": f"Bearer {token}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Call GET first
        get_res = await client.get(f"/api/ml/prediction/{proj_id}", headers=headers)
        print(f"GET prediction status: {get_res.status_code}")
        if get_res.status_code == 200:
            print("Before recalculate:", get_res.json().get("risk_score"), get_res.json().get("predicted_at"))

        # Call POST /api/ml/predict/{proj_id}
        post_res = await client.post(f"/api/ml/predict/{proj_id}", headers=headers)
        print(f"POST predict status: {post_res.status_code}")
        if post_res.status_code != 200:
            print("POST predict error:", post_res.text)
        else:
            data = post_res.json()
            print("After recalculate:", data.get("risk_score"), data.get("predicted_at"), data.get("risk_trend"))

if __name__ == "__main__":
    asyncio.run(main())
