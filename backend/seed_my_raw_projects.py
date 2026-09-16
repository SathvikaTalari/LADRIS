"""
LADRIS — Sync projects from my_raw_projects.csv & run ML predictions
Usage:
    cd backend
    python seed_my_raw_projects.py
"""
import asyncio
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from app.config import get_settings
from app.database import AsyncSessionLocal, check_db_connection
from app.services.project_csv_service import sync_projects_from_csv
from app.services.production_ml_service import ensure_current_prediction, sync_model_registry, warm_production_model


async def main():
    settings = get_settings()
    print("=" * 60)
    print("LADRIS -- ML Project Sync & Predictor Runner")
    print("=" * 60)
    print("Checking database connection...")
    db_ok = await check_db_connection()
    if not db_ok:
        print(f"[ERROR] Cannot connect to PostgreSQL at {settings.effective_host}:{settings.effective_port}/{settings.POSTGRES_DB}!")
        print("        Please start PostgreSQL container: docker compose up -d db")
        return

    print(f"[OK] Connected to PostgreSQL at {settings.effective_host}:{settings.effective_port}/{settings.POSTGRES_DB}")

    print("Loading production ML model...")
    try:
        info = warm_production_model()
        print(f"[OK] Production ML model loaded: version={info['model_version']}")
    except Exception as e:
        print(f"[ERROR] Failed to load ML model: {e}")
        return

    csv_path = settings.resolved_project_data_csv
    print(f"Syncing projects from: {csv_path}")

    async with AsyncSessionLocal() as session:
        await sync_model_registry(session)
        imported_ids = await sync_projects_from_csv(session, csv_path, exclusive=settings.PROJECT_CSV_EXCLUSIVE)
        await session.commit()
        print(f"[OK] Synced {len(imported_ids)} projects into database from my_raw_projects.csv")

        print("Generating ML delay risk predictions & SHAP explanations...")
        scored = 0
        for project_id in imported_ids:
            try:
                await ensure_current_prediction(session, project_id)
                await session.commit()
                scored += 1
            except Exception as exc:
                await session.rollback()
                print(f"  [WARN] Prediction failed for {project_id}: {exc}")
        print(f"[OK] ML Predictions generated for {scored}/{len(imported_ids)} projects.")
        print("=" * 60)
        print("Ready! View Dashboard (http://localhost:5173) or Projects (http://localhost:5173/projects)")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
