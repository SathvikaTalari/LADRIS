"""
LADRIS — FastAPI Application Entry Point
"""
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

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

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.api.ml import router as ml_router
from app.services.production_ml_service import warm_production_model
from app.config import get_settings
from app.database import Base, engine, check_db_connection
from app.models import *  # ensure all models registered
from app.schemas.common import HealthCheck

settings = get_settings()


from app.database import AsyncSessionLocal
from app.services.auth_service import hash_password
from app.models.user import User, UserRole
from sqlalchemy import select, text


async def ensure_default_users():
    """Ensure default system accounts exist with valid hashed passwords."""
    try:
        from app.api.v1.auth import DEMO_USERS

        async with AsyncSessionLocal() as session:
            pass_hash = hash_password("Password123!")

            # Seed or verify all demo accounts from DEMO_USERS
            for email, info in DEMO_USERS.items():
                res = await session.execute(select(User).where(User.email == email))
                existing_user = res.scalar_one_or_none()
                if not existing_user:
                    new_user = User(
                        email=email,
                        full_name=info["full_name"],
                        hashed_password=pass_hash,
                        role=info["role"],
                        state_code=info.get("state_code"),
                        district_code=info.get("district_code"),
                        agency_name=info.get("agency_name"),
                        is_active=True,
                        is_verified=True,
                    )
                    session.add(new_user)
                else:
                    existing_user.hashed_password = pass_hash
                    existing_user.is_active = True
                    existing_user.is_verified = True

            # Also ensure legacy officer@ladris.gov.in exists
            res = await session.execute(select(User).where(User.email == "officer@ladris.gov.in"))
            officer = res.scalar_one_or_none()
            if not officer:
                session.add(
                    User(
                        email="officer@ladris.gov.in",
                        full_name="Test Officer",
                        hashed_password=pass_hash,
                        role=UserRole.PROJECT_OFFICER,
                        is_active=True,
                        is_verified=True,
                    )
                )

            await session.commit()
            print("   ✅ Default user accounts verified (all role accounts active)")
    except Exception as e:
        print(f"   ⚠️ Could not seed default users: {e}")


async def ensure_default_data_sources():
    """Ensure standard Indian national public datasets are registered in data_sources (Requirement #11)."""
    try:
        from app.models.misc import DataSource, DataStatus
        sources = [
            {
                "dataset_name": "BHOOMIRASHI_MORTH_LA",
                "description": "Ministry of Road Transport and Highways (MoRTH) digital Land Acquisition notification portal. Provides 3A/3D/3G notifications, land parcels, and compensation award schedules.",
                "source_organization": "Ministry of Road Transport and Highways (MoRTH)",
                "source_url": "https://bhoomirashi.gov.in/",
                "data_status": DataStatus.OFFICIAL_PUBLIC,
                "file_format": "HTML / REST API",
                "license": "Government Open Data License",
                "record_count": 5200,
                "notes": "Official public digital gazette publication under National Highways Act, 1956.",
            },
            {
                "dataset_name": "LACRRIS_DOLR_PORTAL",
                "description": "Land Acquisition, Compensation, Rehabilitation and Resettlement Information System (LACRRIS) by Department of Land Resources (DoLR).",
                "source_organization": "Department of Land Resources (DoLR), Ministry of Rural Development",
                "source_url": "https://lacrris.gov.in/",
                "data_status": DataStatus.OFFICIAL_PUBLIC,
                "file_format": "JSON / XML",
                "license": "Government Open Data License",
                "record_count": 1850,
                "notes": "RFCTLARR Act 2013 compliance and R&R tracking portal.",
            },
            {
                "dataset_name": "PM_GATISHAKTI_NMP",
                "description": "PM GatiShakti National Master Plan GIS platform integrating infrastructure multi-modal connectivity layers and forest/environmental clearance buffers.",
                "source_organization": "BISAG-N / DPIIT, Ministry of Commerce and Industry",
                "source_url": "https://gatishakti.gov.in/",
                "data_status": DataStatus.OFFICIAL_PUBLIC,
                "file_format": "GeoJSON / WMS",
                "license": "National Spatial Data Infrastructure License",
                "record_count": 12000,
                "notes": "Official spatial GIS platform for infrastructure coordination across 16 ministries.",
            },
            {
                "dataset_name": "DATA_GOV_IN_MORTH_STATUS",
                "description": "Open Government Data Platform India (data.gov.in) — National Highway project land acquisition progress and financial expenditure reports.",
                "source_organization": "National Informatics Centre (NIC) / data.gov.in",
                "source_url": "https://data.gov.in/catalog/nh-project-wise-land-acquisition-status",
                "data_status": DataStatus.OFFICIAL_PUBLIC,
                "file_format": "CSV / REST API",
                "license": "Government Open Data License (GODL)",
                "record_count": 2500,
                "notes": "Official open government data catalog publication.",
            },
            {
                "dataset_name": "CENSUS_2011_PCA",
                "description": "Primary Census Abstract (PCA) 2011 district-level baseline demographics, household counts, and rural/urban land categorization.",
                "source_organization": "Office of the Registrar General & Census Commissioner, India",
                "source_url": "https://censusindia.gov.in/",
                "data_status": DataStatus.OFFICIAL_PUBLIC,
                "file_format": "CSV",
                "license": "Public Domain",
                "record_count": 640,
                "notes": "Official Indian decennial census records.",
            },
            {
                "dataset_name": "STATE_ROR_DIGITAL_PORTALS",
                "description": "Digital Land Records Modernization Programme (DILRMP) state portals: Bhulekh (UP), MahaBhulekh (MH), Bhoomi (KA), MeeBhoomi (AP), Dharani (TS), AnyRoR (GJ).",
                "source_organization": "State Revenue & Disaster Management Departments",
                "source_url": "https://dilrmp.gov.in/",
                "data_status": DataStatus.OFFICIAL_PUBLIC,
                "file_format": "REST API / State Cadastral APIs",
                "license": "State Revenue Department Public Access",
                "record_count": 8500,
                "notes": "Verified cadastral land title records across Indian states.",
            },
        ]

        async with AsyncSessionLocal() as session:
            for s in sources:
                existing = (await session.execute(
                    select(DataSource).where(DataSource.dataset_name == s["dataset_name"])
                )).scalar_one_or_none()
                if not existing:
                    ds = DataSource(
                        dataset_name=s["dataset_name"],
                        description=s["description"],
                        source_organization=s["source_organization"],
                        source_url=s["source_url"],
                        data_status=s["data_status"],
                        file_format=s["file_format"],
                        license=s["license"],
                        record_count=s["record_count"],
                        notes=s["notes"],
                        is_active=True,
                    )
                    session.add(ds)
            await session.commit()
            print("   ✅ Official government data sources verified (BhoomiRashi, LACRRIS, PM GatiShakti, Census, RoR)")
    except Exception as e:
        print(f"   ⚠️ Could not seed default data sources: {e}")


# ─── Lifespan (startup/shutdown) ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup checks and graceful shutdown."""
    print(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} starting up...")
    print(f"   Environment: {settings.APP_ENV}")
    try:
        try:
            async with engine.connect() as raw_conn:
                raw_conn = await raw_conn.execution_options(isolation_level="AUTOCOMMIT")
                for ext in ['uuid-ossp', 'postgis', 'pg_trgm']:
                    try:
                        await raw_conn.execute(text(f'CREATE EXTENSION IF NOT EXISTS "{ext}"'))
                    except Exception:
                        pass
                for r in ['CENTRAL_ADMIN', 'LA_OFFICER', 'PROJECT_AGENCY', 'POLICY_ANALYST']:
                    try:
                        await raw_conn.execute(text(f"ALTER TYPE user_role ADD VALUE IF NOT EXISTS '{r}'"))
                    except Exception:
                        pass
        except Exception:
            pass

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_name VARCHAR(255)"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_project_ids VARCHAR(1024)"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)"))
            await conn.execute(text("""
                ALTER TABLE projects 
                    ADD COLUMN IF NOT EXISTS notification_3a_date DATE,
                    ADD COLUMN IF NOT EXISTS notification_3d_date DATE,
                    ADD COLUMN IF NOT EXISTS delay_months INTEGER,
                    ADD COLUMN IF NOT EXISTS delay_reason TEXT,
                    ADD COLUMN IF NOT EXISTS legal_case_count INTEGER DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS legal_case_status VARCHAR(50) DEFAULT 'NONE',
                    ADD COLUMN IF NOT EXISTS rehabilitation_progress_pct NUMERIC(5, 2),
                    ADD COLUMN IF NOT EXISTS milestone_data_status VARCHAR(50) DEFAULT 'USER_ENTERED',
                    ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
                    ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
                    ADD COLUMN IF NOT EXISTS lacrris_integration_status VARCHAR(50) DEFAULT 'PLANNED'
            """))
            await conn.execute(text("ALTER TABLE projects ALTER COLUMN district_codes TYPE TEXT[] USING district_codes::text[]"))
            await conn.execute(text("ALTER TABLE projects ALTER COLUMN milestone_data_status SET DEFAULT 'USER_ENTERED'"))
            await conn.execute(text("ALTER TABLE rr_records ADD COLUMN IF NOT EXISTS resettlement_site_ready BOOLEAN"))
        print("   ✅ Database tables & PostGIS schema verified")
    except Exception as e:
        print(f"   ⚠️  Database auto-migration warning: {e}")
    db_ok = await check_db_connection()
    if db_ok:
        print(f"   ✅ Database connection: OK ({settings.effective_host}:{settings.effective_port}/{settings.POSTGRES_DB})")
        await ensure_default_users()
        await ensure_default_data_sources()
    else:
        print(f"   ⚠️  Database connection: FAILED ({settings.effective_host}:{settings.effective_port}/{settings.POSTGRES_DB})")
        print("       Tip: Start Docker with 'docker compose up -d db' or run 'python doctor.py'")
    model_ready = False
    try:
        info = warm_production_model()
        model_ready = True
        print(f"   ✅ Production ML model loaded: {info['model_version']}")
    except Exception as exc:
        print(f"   ⚠️  Production ML model unavailable: {exc}")
        print("       Tip: Run 'python doctor.py' to verify ML dependencies and model artifacts.")
    if db_ok and settings.SYNC_PROJECTS_FROM_CSV:
        try:
            from app.services.project_csv_service import sync_projects_from_csv
            from app.services.production_ml_service import ensure_current_prediction, sync_model_registry

            async with AsyncSessionLocal() as session:
                await sync_model_registry(session)
                imported_ids = await sync_projects_from_csv(
                    session,
                    settings.resolved_project_data_csv,
                    exclusive=settings.PROJECT_CSV_EXCLUSIVE,
                )
                await session.commit()
                if model_ready:
                    for project_id in imported_ids:
                        try:
                            await ensure_current_prediction(session, project_id)
                            await session.commit()
                        except Exception as prediction_exc:
                            await session.rollback()
                            print(f"   ⚠️  Prediction failed for {project_id}: {prediction_exc}")
            print(f"   ✅ Project CSV synchronized: {len(imported_ids)} project(s)")
        except Exception as exc:
            print(f"   ⚠️  Project CSV synchronization failed: {exc}")
    yield
    print(f"🛑 {settings.APP_NAME} shutting down...")


# ─── Application Factory ──────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "AI-Powered Land Acquisition Early-Warning & Intervention Intelligence Platform. "
        "Production calibrated LightGBM delay prediction, explanations, monitoring, and decision support."
    ),
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + [
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
)


# ─── Request Timing Middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time_ms = int((time.perf_counter() - start_time) * 1000)
    response.headers["X-Process-Time"] = f"{process_time_ms}ms"
    return response


# ─── Health & Readiness Check ───────────────────────────────────────────────────
@app.get("/health", response_model=HealthCheck, tags=["System"])
async def health_check() -> HealthCheck:
    """
    System health check.
    Returns database connectivity status and application metadata.
    """
    db_ok = await check_db_connection()
    return HealthCheck(
        status="healthy" if db_ok else "degraded",
        version=settings.APP_VERSION,
        environment=settings.APP_ENV,
        database="connected" if db_ok else "unreachable",
        timestamp=datetime.now(tz=timezone.utc),
    )

@app.get("/ready", tags=["System"])
async def readiness_check():
    """
    Readiness probe for orchestration.
    """
    db_ok = await check_db_connection()
    if db_ok:
        return {"status": "ready"}
    else:
        return JSONResponse(status_code=503, content={"status": "not_ready", "reason": "db_unreachable"})


# ─── Root Redirect ────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    return JSONResponse({
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health",
    })


# ─── Mount API Router ─────────────────────────────────────────────────────────
from app.api.v1.decision_intelligence import router as decision_intelligence_router
app.include_router(api_router)
app.include_router(ml_router)
app.include_router(decision_intelligence_router, prefix="/api")

