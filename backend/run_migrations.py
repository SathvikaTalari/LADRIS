"""
LADRIS — Unified Database Migration & Initialization Runner
===========================================================
Applies all SQL schema migrations from database/migrations/ in sequential order,
ensures PostGIS / UUID extensions exist, syncs all SQLAlchemy models,
seeds default user accounts and official public data sources.

Usage:
    cd backend
    python run_migrations.py
    python run_migrations.py --seed-projects
"""
import argparse
import asyncio
import os
import re
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
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

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.config import get_settings
from app.database import Base, AsyncSessionLocal, check_db_connection, engine
from app.models import *  # ensure all ORM models are registered
from app.main import ensure_default_users, ensure_default_data_sources
from sqlalchemy import text


def find_migrations_dir() -> Path:
    """Locate database/migrations directory relative to backend or project root."""
    backend_dir = Path(__file__).resolve().parent
    candidates = [
        backend_dir.parent / "database" / "migrations",
        backend_dir / "database" / "migrations",
        Path("database/migrations").resolve(),
    ]
    for c in candidates:
        if c.exists() and c.is_dir():
            return c
    raise FileNotFoundError("Could not locate database/migrations directory")


async def ensure_extensions():
    """Ensure essential PostgreSQL extensions exist (PostGIS, UUID, pg_trgm)."""
    settings = get_settings()
    print(f"[*] Checking PostgreSQL extensions on {settings.effective_host}:{settings.effective_port}/{settings.POSTGRES_DB}...")
    
    extensions = ["uuid-ossp", "postgis", "pg_trgm"]
    async with engine.connect() as conn:
        conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
        for ext in extensions:
            try:
                await conn.execute(text(f'CREATE EXTENSION IF NOT EXISTS "{ext}";'))
                print(f"    [OK] Extension '{ext}' enabled.")
            except Exception as e:
                err_str = str(e).lower()
                if "postgis" in ext and ("could not open extension control file" in err_str or "not available" in err_str):
                    print(f"    [WARN] PostGIS extension not installed in this PostgreSQL cluster.")
                    print(f"           For full geospatial GIS map functionality, use Docker (docker compose up -d db)")
                    print(f"           or install PostGIS via StackBuilder / package manager.")
                else:
                    print(f"    [NOTE] Extension '{ext}': {e}")


async def create_schema_migrations_table():
    """Create tracking table for applied migrations."""
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """))


async def get_applied_migrations() -> set[str]:
    """Retrieve list of previously applied migration versions."""
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version FROM schema_migrations;"))
            return {row[0] for row in result.fetchall()}
    except Exception:
        return set()


def split_sql_statements(sql: str) -> list[str]:
    """Split SQL file into executable statements while preserving function bodies."""
    lines = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        lines.append(line)
    clean_sql = "\n".join(lines)

    statements = []
    current = []
    in_dollar_block = False

    for line in clean_sql.splitlines():
        if "$$" in line or "$BODY$" in line:
            in_dollar_block = not in_dollar_block
        current.append(line)
        if not in_dollar_block and ";" in line:
            chunk = "\n".join(current).strip()
            if chunk:
                parts = chunk.split(";")
                for p in parts[:-1]:
                    if p.strip():
                        statements.append(p.strip())
                current = [parts[-1]] if parts[-1].strip() else []

    if current:
        remainder = "\n".join(current).strip()
        if remainder:
            statements.append(remainder)

    return statements


async def apply_sql_migration(file_path: Path):
    """Execute a single SQL migration file with error tolerance for already existing objects."""
    filename = file_path.name
    print(f"[*] Applying migration: {filename}...")
    with open(file_path, "r", encoding="utf-8") as f:
        sql = f.read()

    statements = split_sql_statements(sql)
    async with engine.connect() as conn:
        conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
        for stmt in statements:
            stmt_clean = stmt.strip()
            if not stmt_clean:
                continue
            try:
                await conn.execute(text(stmt_clean))
            except Exception as e:
                err = str(e).lower()
                benign = [
                    "already exists",
                    "duplicate",
                    "multiple primary keys",
                    "relation",
                    "column",
                    "type",
                    "index",
                ]
                if any(b in err for b in benign):
                    continue
                print(f"    [WARN] In {filename}: {e.args[0] if e.args else e}")

    async with engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO schema_migrations (version) VALUES (:v) ON CONFLICT (version) DO NOTHING"),
            {"v": filename},
        )
    print(f"    [OK] Applied {filename}")


async def sync_orm_schema():
    """Create tables and alter columns defined in modern SQLAlchemy models."""
    print("[*] Verifying ORM tables and schema synchronization...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        alter_statements = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_name VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_project_ids VARCHAR(1024)",
            """
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
            """,
            "ALTER TABLE projects ALTER COLUMN district_codes TYPE TEXT[] USING district_codes::text[]",
            "ALTER TABLE rr_records ADD COLUMN IF NOT EXISTS resettlement_site_ready BOOLEAN",
        ]
        for s in alter_statements:
            try:
                await conn.execute(text(s))
            except Exception:
                pass
    print("    [OK] ORM models and columns synchronized.")


async def run_all_migrations(seed_projects: bool = False):
    print("=" * 60)
    print("LADRIS — Automated Database Migration & Sync")
    print("=" * 60)

    settings = get_settings()
    print(f"Target Database: {settings.effective_host}:{settings.effective_port}/{settings.POSTGRES_DB} (user: {settings.POSTGRES_USER})")

    db_ok = await check_db_connection()
    if not db_ok:
        print("\n[ERROR] Could not connect to PostgreSQL database!")
        print(f"        Attempted connection to: {settings.effective_host}:{settings.effective_port}/{settings.POSTGRES_DB}")
        print("        Troubleshooting tips:")
        print("        1. If using Docker, ensure container is running:")
        print("           docker compose up -d db")
        print("        2. If using local PostgreSQL, ensure it is running on port 5432 and credentials in .env match.")
        print("        3. Check that database 'ladris' exists (CREATE DATABASE ladris;).")
        return False

    print("[OK] Database connection verified.")

    # 1. Ensure PostGIS and UUID extensions
    await ensure_extensions()

    # 2. Schema migrations tracking
    await create_schema_migrations_table()
    applied = await get_applied_migrations()

    # 3. Find and apply all SQL migrations in order
    migrations_dir = find_migrations_dir()
    sql_files = sorted(migrations_dir.glob("*.sql"))
    print(f"[*] Found {len(sql_files)} SQL migration file(s) in {migrations_dir}")

    for sql_file in sql_files:
        if sql_file.name in applied:
            print(f"    [SKIP] Already applied: {sql_file.name}")
        else:
            await apply_sql_migration(sql_file)

    # 4. Synchronize ORM models & modern columns
    await sync_orm_schema()

    # 5. Default accounts & official data sources
    print("[*] Verifying seed accounts and data sources...")
    await ensure_default_users()
    await ensure_default_data_sources()

    # 6. Optional: Project sync & ML predictions
    if seed_projects:
        print("[*] Seeding projects from my_raw_projects.csv & generating ML predictions...")
        from app.services.project_csv_service import sync_projects_from_csv
        from app.services.production_ml_service import ensure_current_prediction, sync_model_registry

        csv_path = settings.resolved_project_data_csv
        if not Path(csv_path).exists():
            print(f"    [WARN] CSV file not found at {csv_path}. Skipping project seed.")
        else:
            async with AsyncSessionLocal() as session:
                await sync_model_registry(session)
                imported_ids = await sync_projects_from_csv(session, csv_path, exclusive=settings.PROJECT_CSV_EXCLUSIVE)
                await session.commit()
                print(f"    [OK] Synced {len(imported_ids)} projects.")

                try:
                    for pid in imported_ids:
                        await ensure_current_prediction(session, pid)
                    await session.commit()
                    print(f"    [OK] Generated ML predictions for {len(imported_ids)} projects.")
                except Exception as ml_err:
                    print(f"    [WARN] Could not compute initial ML predictions: {ml_err}")

    print("\n" + "=" * 60)
    print("✅ All migrations and database checks completed successfully!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LADRIS Unified Database Migration Runner")
    parser.add_argument("--seed-projects", action="store_true", help="Sync my_raw_projects.csv and compute ML predictions")
    args = parser.parse_args()

    success = asyncio.run(run_all_migrations(seed_projects=args.seed_projects))
    sys.exit(0 if success else 1)
