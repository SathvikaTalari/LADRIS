import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database import AsyncSessionLocal
from app.models.project import Project
from app.models.ml_models import MLPrediction
from app.services.production_ml_service import generate_prediction, latest_prediction
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Project).where(Project.project_code.ilike("%1789618841916%")))
        project = res.scalars().first()
        if not project:
            print("Project with code containing 1789618841916 not found, searching for Mumbai-Goa...")
            res2 = await db.execute(select(Project).where(Project.name.ilike("%Mumbai-Goa%")))
            project = res2.scalars().first()
        
        if not project:
            print("Not found! Listing top 5 projects:")
            all_p = (await db.execute(select(Project).limit(5))).scalars().all()
            for p in all_p:
                print(f"  {p.project_code} - {p.name}")
            return

        print(f"Found project: ID={project.id}, Code={project.project_code}, Name={project.name}")
        
        # Check existing predictions count
        preds = (await db.execute(select(MLPrediction).where(MLPrediction.project_id == project.id).order_by(MLPrediction.predicted_at.desc()))).scalars().all()
        print(f"Existing predictions count: {len(preds)}")
        for i, p in enumerate(preds[:3]):
            print(f"  [{i}] ID={p.id}, predicted_at={p.predicted_at}, risk_score={p.risk_score}, delay_prob={p.delay_probability}")

        # Now test generate_prediction
        print("\n--- Running generate_prediction ---")
        new_pred = await generate_prediction(db, project.id)
        await db.commit()
        print(f"New prediction generated! Risk score: {new_pred['risk_score']}, delay_prob: {new_pred['delay_probability']}, latency_ms: {new_pred['latency_ms']}")
        print(f"Predicted delay days: {new_pred['predicted_delay_days']}, Range: {new_pred['delay_range']}")

if __name__ == "__main__":
    asyncio.run(main())
