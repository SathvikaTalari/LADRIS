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

        print("Seeding baseline Action Ledger interventions for Decision Intelligence...")
        from datetime import date, timedelta
        from sqlalchemy import func, select
        from app.models.decision_intelligence import ProjectIntervention
        from app.models.project import Project
        from app.schemas.decision_intelligence import ProjectInterventionCreate
        from app.services.decision_intelligence_service import record_intervention

        seeded_interventions = 0
        for project_id in imported_ids:
            count = (await session.execute(
                select(func.count(ProjectIntervention.id)).where(ProjectIntervention.project_id == project_id)
            )).scalar_one()
            if count == 0:
                project = await session.get(Project, project_id)
                if not project:
                    continue
                agency = project.nodal_agency or "CALA"
                executing = project.executing_agency or "District Administration"
                if (project.legal_case_count or 0) > 0:
                    act = ProjectInterventionCreate(
                        intervention_type="DISPUTE_RESOLUTION",
                        title="Special Lok Adalat Fast-Track Dispute Settlement",
                        description="Settled contested land acquisition title objections through mutual consent awards with District Legal Services Authority.",
                        action_taken_by=f"District Revenue Officer & Legal Cell, {agency}",
                        action_date=date.today() - timedelta(days=14),
                        resolved_disputes_count=1,
                    )
                elif (project.rehabilitation_progress_pct or 0) > 0:
                    act = ProjectInterventionCreate(
                        intervention_type="RR_PROGRESS",
                        title="R&R Resettlement Amenities & Entitlement Clearance",
                        description="Completed civic infrastructure development and issued allotment certificates for project affected families.",
                        action_taken_by="Sub-Divisional Magistrate (SDM) / R&R Administrator",
                        action_date=date.today() - timedelta(days=21),
                        updated_rr_pct=min(100.0, float(project.rehabilitation_progress_pct or 50.0) + 15.0),
                    )
                elif (project.disbursed_compensation_inr or 0) > 0:
                    comp_pct = 50.0
                    if project.estimated_compensation_inr and project.estimated_compensation_inr > 0:
                        comp_pct = min(100.0, float(project.disbursed_compensation_inr) / float(project.estimated_compensation_inr) * 100.0)
                    act = ProjectInterventionCreate(
                        intervention_type="COMPENSATION_RELEASE",
                        title="Special Direct Benefit Award Disbursement Drive",
                        description="Expedited direct electronic compensation transfers to verified khatedar land accounts under Section 23/37.",
                        action_taken_by=f"Competent Authority (CALA) / {executing}",
                        action_date=date.today() - timedelta(days=18),
                        updated_compensation_pct=min(100.0, comp_pct + 15.0),
                    )
                else:
                    act = ProjectInterventionCreate(
                        intervention_type="POSSESSION_ACTION",
                        title="Joint Demarcation & Boundary Pegging Drive",
                        description="Completed joint measurement survey (JMS) and physical alignment demarcation with revenue survey teams.",
                        action_taken_by="Competent Authority for Land Acquisition (CALA)",
                        action_date=date.today() - timedelta(days=28),
                    )
                try:
                    await record_intervention(project.id, act, session)
                    await session.commit()
                    seeded_interventions += 1
                except Exception as err:
                    await session.rollback()
                    print(f"  [WARN] Failed to seed intervention for {project.project_code}: {err}")
        print(f"[OK] Action Ledger baseline interventions verified/seeded ({seeded_interventions} newly added).")
        print("=" * 60)
        print("Ready! View Dashboard (http://localhost:5173) or Projects (http://localhost:5173/projects)")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
