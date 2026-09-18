#!/usr/bin/env python3
"""
LADRIS — Team Development Environment Doctor & Auto-Fix Tool
============================================================
Diagnoses and repairs frequent issues with:
  1. PostgreSQL & PostGIS database connectivity (Docker & native)
  2. Database schema migrations (001 through 012)
  3. ML dependencies (LightGBM, SHAP, Scikit-Learn)
  4. ML model artifacts and path resolution
  5. Live ML inference and database project seeds

Usage:
    python doctor.py
    python doctor.py --fix
"""
import argparse
import asyncio
import os
import platform
import shutil
import socket
import subprocess
import sys
import time
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

REPO_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = REPO_ROOT / "backend"

# ANSI Colors
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

passed_checks = 0
total_checks = 0
warnings = []
errors = []


def step(title: str):
    print(f"\n{BOLD}{CYAN}=== {title} ==={RESET}")


def check_ok(msg: str):
    global passed_checks, total_checks
    total_checks += 1
    passed_checks += 1
    print(f"  {GREEN}✔ [OK]{RESET} {msg}")


def check_warn(msg: str, hint: str = ""):
    global total_checks, warnings
    total_checks += 1
    warnings.append(msg)
    print(f"  {YELLOW}⚠ [WARN]{RESET} {msg}")
    if hint:
        print(f"     {YELLOW}↳ Tip: {hint}{RESET}")


def check_fail(msg: str, hint: str = ""):
    global total_checks, errors
    total_checks += 1
    errors.append(msg)
    print(f"  {RED}✘ [FAIL]{RESET} {msg}")
    if hint:
        print(f"     {RED}↳ Fix: {hint}{RESET}")


def is_port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


# ─── 1. Python & OS Audit ───────────────────────────────────────────────────
def check_python_env():
    step("1. Python & Runtime Environment")
    py_ver = sys.version.split()[0]
    os_name = f"{platform.system()} {platform.release()} ({platform.machine()})"
    print(f"  Operating System: {os_name}")
    print(f"  Python Version:   {py_ver} ({sys.executable})")

    major, minor = sys.version_info[:2]
    if major == 3 and 10 <= minor <= 12:
        check_ok(f"Python version {py_ver} is officially supported (3.10 – 3.12).")
    elif major == 3 and minor >= 13:
        check_warn(
            f"Python {py_ver} detected. Pre-compiled wheels for SHAP or LightGBM might be experimental on Python 3.13+.",
            "If pip install fails, use Python 3.11 or 3.12."
        )
    else:
        check_fail(f"Python version {py_ver} is too old. LADRIS requires Python 3.10+.")

    in_venv = (sys.prefix != sys.base_prefix) or ("venv" in sys.executable.lower())
    if in_venv:
        check_ok("Running inside a Python virtual environment.")
    else:
        check_warn(
            "Running in global Python environment.",
            f"Recommended: activate backend virtual environment ({BACKEND_DIR / 'venv'})."
        )


# ─── 2. Environment (.env) Audit ────────────────────────────────────────────
def check_environment_file(auto_fix: bool = False):
    step("2. Environment Configuration (.env)")
    root_env = REPO_ROOT / ".env"
    example_env = REPO_ROOT / ".env.example"

    if not root_env.exists():
        if example_env.exists():
            if auto_fix:
                shutil.copy(example_env, root_env)
                check_ok("Created .env from .env.example automatically.")
            else:
                check_fail(
                    "Root .env file is missing!",
                    "Run 'python doctor.py --fix' or copy .env.example to .env."
                )
        else:
            check_fail(".env.example is missing in repo root!")
    else:
        check_ok("Root .env file exists.")

    # Check key variables
    if root_env.exists():
        content = root_env.read_text(encoding="utf-8", errors="replace")
        for key in ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_PORT"]:
            if key in content:
                check_ok(f"Environment variable '{key}' defined in .env.")
            else:
                check_warn(f"'{key}' not found in .env.", "Check .env.example for default values.")


# ─── 3. Docker & Container Status ───────────────────────────────────────────
def check_docker_status(auto_fix: bool = False):
    step("3. Docker & Container Services")
    docker_bin = shutil.which("docker")
    if not docker_bin:
        check_warn(
            "Docker CLI is not installed or not in PATH.",
            "If using Docker, install Docker Desktop. If using native PostgreSQL, ensure it runs on port 5432."
        )
        return

    try:
        res = subprocess.run(["docker", "info"], capture_output=True, text=True, timeout=3)
        if res.returncode != 0:
            check_warn(
                "Docker daemon is not running.",
                "Start Docker Desktop to use the containerized PostGIS database."
            )
            return
        check_ok("Docker daemon is running and responsive.")
    except Exception:
        check_warn("Docker daemon check timed out or failed.")
        return

    # Check container landpulse_db
    try:
        res = subprocess.run(
            ["docker", "ps", "--filter", "name=landpulse_db", "--format", "{{.Names}} - {{.Status}}"],
            capture_output=True, text=True, timeout=3
        )
        output = res.stdout.strip()
        if "landpulse_db" in output:
            check_ok(f"Container 'landpulse_db' is active: {output}")
        else:
            if auto_fix:
                print("  [*] Attempting to start database container (docker compose up -d db)...")
                up_res = subprocess.run(["docker", "compose", "up", "-d", "db"], cwd=REPO_ROOT, capture_output=True, text=True)
                if up_res.returncode == 0:
                    check_ok("Started database container 'landpulse_db'.")
                    time.sleep(2)
                else:
                    check_fail("Failed to start container with docker compose.", up_res.stderr.strip())
            else:
                check_warn(
                    "Container 'landpulse_db' is not running.",
                    "Start it with: docker compose up -d db"
                )
    except Exception as e:
        check_warn(f"Could not inspect Docker containers: {e}")


# ─── 4. Database Connectivity & PostGIS ──────────────────────────────────────
async def check_database(auto_fix: bool = False):
    step("4. PostgreSQL & PostGIS Database Connectivity")

    # Add backend to sys.path so we can import app modules
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))

    try:
        from app.config import get_settings
        from app.database import engine, check_db_connection
        from sqlalchemy import text
    except ImportError as e:
        check_fail(f"Could not import backend database modules: {e}", "Ensure backend dependencies are installed: pip install -r backend/requirements.txt")
        return False

    settings = get_settings()
    host = settings.effective_host
    port = settings.effective_port
    dbname = settings.POSTGRES_DB
    user = settings.POSTGRES_USER

    print(f"  Configured Target: {host}:{port}/{dbname} (User: {user})")

    # Check port accessibility
    port_open = is_port_open(host, port, timeout=1.0)
    if not port_open:
        check_fail(
            f"Port {port} on {host} is unreachable!",
            f"If using Docker, run 'docker compose up -d db' (port 15432). If local Postgres, start service on port {port}."
        )
        # Check if alternative port is open
        alt_port = 5432 if port == 15432 else 15432
        if is_port_open(host, alt_port, timeout=0.5):
            check_warn(
                f"Alternative PostgreSQL port {alt_port} IS reachable!",
                f"Update POSTGRES_PORT={alt_port} in your .env file."
            )
        return False

    check_ok(f"PostgreSQL network port {port} is open and accepting TCP connections.")

    # Test full SQLAlchemy async connection
    db_connected = await check_db_connection()
    if not db_connected:
        check_fail(
            f"Authentication or database connection failed to {host}:{port}/{dbname}!",
            f"Verify password in .env (default: 'landpulse_pass') and verify database '{dbname}' exists."
        )
        return False

    check_ok("SQLAlchemy database connection verified.")

    # Check PostGIS extension
    has_postgis = False
    try:
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'uuid-ossp', 'pg_trgm');"))
            installed_exts = {r[0] for r in res.fetchall()}
            
            if "uuid-ossp" in installed_exts:
                check_ok("Extension 'uuid-ossp' is installed.")
            else:
                if auto_fix:
                    try:
                        conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
                        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
                        check_ok("Extension 'uuid-ossp' installed automatically.")
                    except Exception:
                        check_warn("Could not auto-install 'uuid-ossp'.")
                else:
                    check_warn("Extension 'uuid-ossp' is not installed.")

            if "postgis" in installed_exts:
                check_ok("PostGIS extension is installed and active.")
                has_postgis = True
            else:
                if auto_fix:
                    try:
                        conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
                        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                        check_ok("PostGIS extension enabled automatically.")
                        has_postgis = True
                    except Exception as ext_err:
                        check_warn(
                            f"PostGIS extension auto-installation failed: {ext_err}",
                            "For full GIS map support, use the official Docker image (docker compose up -d db) or install PostGIS."
                        )
                else:
                    check_warn(
                        "PostGIS extension is not installed on this database.",
                        "If using local Postgres, install PostGIS via StackBuilder or switch to Docker: docker compose up -d db."
                    )
    except Exception as e:
        check_warn(f"Could not inspect PostgreSQL extensions: {e}")

    # Check table count
    try:
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"))
            tbl_count = res.scalar() or 0
            if tbl_count >= 10:
                check_ok(f"Database schema verified: {tbl_count} tables present.")
            elif tbl_count > 0:
                check_warn(f"Only {tbl_count} tables found. Migrations may be incomplete.", "Run: python backend/run_migrations.py")
            else:
                if auto_fix:
                    print("  [*] Running database migrations now...")
                    from run_migrations import run_all_migrations
                    await run_all_migrations()
                    check_ok("Applied all database migrations.")
                else:
                    check_warn("Database is empty (0 tables).", "Run 'python backend/run_migrations.py' or 'python doctor.py --fix'.")
    except Exception as e:
        check_warn(f"Could not count tables: {e}")

    return True


# ─── 5. ML Dependencies Audit ───────────────────────────────────────────────
def check_ml_dependencies():
    step("5. Machine Learning Dependencies")
    modules = [
        ("lightgbm", "LightGBM gradient boosting"),
        ("shap", "SHAP TreeExplainer"),
        ("sklearn", "Scikit-Learn algorithms & metrics"),
        ("joblib", "Joblib model serialization"),
        ("pandas", "Pandas DataFrame manipulation"),
        ("numpy", "NumPy array computing"),
    ]

    all_passed = True
    for mod_name, desc in modules:
        try:
            mod = __import__(mod_name)
            ver = getattr(mod, "__version__", "installed")
            check_ok(f"{mod_name} v{ver} ({desc})")
        except ImportError as e:
            all_passed = False
            hint = f"Install with: pip install -r backend/requirements.txt"
            if mod_name == "shap" and platform.system() == "Windows":
                hint = "On Windows, install pre-built wheel or Microsoft C++ Build Tools: pip install shap --only-binary=:all:"
            elif mod_name == "lightgbm" and platform.system() == "Darwin":
                hint = "On macOS, install OpenMP runtime: brew install libomp"
            check_fail(f"Missing dependency '{mod_name}' ({e})", hint)

    return all_passed


# ─── 6. ML Model Artifacts & File Resolution ────────────────────────────────
def check_ml_artifacts():
    step("6. ML Model Artifacts & Paths")
    try:
        from app.config import get_settings
        settings = get_settings()
        models_dir = Path(settings.resolved_models_dir)
        ml_module_path = Path(settings.resolved_ml_module_path)
        project_csv = Path(settings.resolved_project_data_csv)
    except Exception as e:
        check_fail(f"Could not resolve model paths from config: {e}")
        return False

    print(f"  ML Module Path:  {ml_module_path}")
    print(f"  Models Dir:      {models_dir}")
    print(f"  Project CSV:     {project_csv}")

    # 1. Module path
    if ml_module_path.exists() and (ml_module_path / "ml").exists():
        check_ok("ML Python package directory found.")
    else:
        check_fail(f"ML module path '{ml_module_path}' does not exist or lacks 'ml/' package.")

    # 2. Models dir
    if not models_dir.exists():
        check_fail(f"Models directory not found at: {models_dir}")
        return False
    check_ok(f"Models directory exists.")

    # 3. Latest pointer
    latest_file = models_dir / "latest.txt"
    if not latest_file.exists():
        check_fail("models/latest.txt pointer file is missing!")
        return False

    latest_version = latest_file.read_text(encoding="utf-8").strip()
    check_ok(f"models/latest.txt points to model version: '{latest_version}'")

    # 4. Check model files inside latest version
    run_dir = models_dir / latest_version
    if not run_dir.exists():
        check_fail(f"Model version directory '{run_dir}' does not exist!")
        return False

    required_artifacts = [
        ("classifier.joblib", "Trained LightGBM Classifier"),
        ("regressor.joblib", "Trained Delay Duration Regressor"),
        ("metadata.json", "Model Training Metadata & Feature Contract"),
    ]
    for filename, desc in required_artifacts:
        fpath = run_dir / filename
        if fpath.exists() and fpath.stat().st_size > 0:
            sz_kb = fpath.stat().st_size / 1024
            check_ok(f"{filename} exists ({sz_kb:.1f} KB - {desc})")
        else:
            check_fail(f"Missing artifact: {filename} in {run_dir}")

    # 5. Project CSV
    if project_csv.exists() and project_csv.stat().st_size > 0:
        lines = len(project_csv.read_text(encoding="utf-8", errors="replace").splitlines())
        check_ok(f"my_raw_projects.csv exists ({lines} rows including header).")
    else:
        check_warn(f"Project CSV not found at: {project_csv}")

    return True


# ─── 7. Live ML Inference Test ──────────────────────────────────────────────
def check_ml_live_inference():
    step("7. Live ML Inference & Prediction Pipeline")
    try:
        from app.services.production_ml_service import warm_production_model, _runtime
        t0 = time.perf_counter()
        info = warm_production_model()
        dt_ms = (time.perf_counter() - t0) * 1000
        check_ok(f"Model warm-up succeeded: version={info['model_version']} ({dt_ms:.1f} ms)")
    except Exception as e:
        check_fail(f"Failed to load production ML model: {e}")
        return False

    # Perform sample prediction
    try:
        rt = _runtime()
        bundle = rt.get_bundle()
        feature_cols = bundle["feature_columns"]
        cat_cols = bundle["categorical_columns"]

        sample = {c: 0 for c in feature_cols}
        for c in cat_cols:
            sample[c] = (
                "highway" if c == "project_type" else
                "NHAI" if c == "implementing_agency" else
                "Telangana" if c == "state" else
                "Sangareddy" if c == "district" else
                "possession"
            )
        sample["compensation_disbursement_pct"] = 45.0
        sample["legal_dispute_count"] = 4
        sample["open_legal_dispute_count"] = 2
        sample["compensation_sanctioned"] = 100000000.0
        sample["compensation_disbursed"] = 45000000.0

        t1 = time.perf_counter()
        pred = rt.predict_features(sample)
        pred_ms = (time.perf_counter() - t1) * 1000

        risk = pred["risk_score"]
        delay = pred["predicted_delay_days"]
        prob = pred["delay_probability"]
        check_ok(f"Test inference passed: Risk Score={risk:.1f}/100, Delay={delay:.1f} days, Prob={prob:.2f} ({pred_ms:.1f} ms)")
        return True
    except Exception as e:
        check_fail(f"Test inference failed: {e}")
        return False


# ─── 8. Seeded Projects & Predictions in DB ─────────────────────────────────
async def check_db_seeds(auto_fix: bool = False):
    step("8. Database Data & Seed Status")
    try:
        from app.database import engine, AsyncSessionLocal
        from sqlalchemy import text
        from app.models.project import Project
        from app.models.ml_models import MLPrediction
        from app.models.user import User

        async with AsyncSessionLocal() as session:
            # Users
            res_users = await session.execute(text("SELECT count(*) FROM users;"))
            u_count = res_users.scalar() or 0
            if u_count >= 2:
                check_ok(f"User accounts verified ({u_count} users present).")
            else:
                check_warn(f"Only {u_count} user(s) found.", "Run 'python backend/run_migrations.py' to seed default admin and officer accounts.")

            # Projects
            res_proj = await session.execute(text("SELECT count(*) FROM projects WHERE deleted_at IS NULL;"))
            p_count = res_proj.scalar() or 0
            if p_count >= 20:
                check_ok(f"Verified projects loaded: {p_count} active projects in database.")
            elif p_count > 0:
                check_ok(f"{p_count} project(s) present in database.")
            else:
                if auto_fix:
                    print("  [*] Seeding projects from my_raw_projects.csv...")
                    res = subprocess.run([sys.executable, "seed_my_raw_projects.py"], cwd=BACKEND_DIR, capture_output=True, text=True)
                    if res.returncode == 0:
                        check_ok("Seeded projects and computed ML predictions.")
                    else:
                        check_warn("Project seed script returned an error.", res.stderr.strip())
                else:
                    check_warn(
                        "0 projects in database! UI dashboards will appear empty.",
                        "Run: cd backend && python seed_my_raw_projects.py"
                    )

            # Predictions
            res_pred = await session.execute(text("SELECT count(*) FROM ml_predictions;"))
            pred_count = res_pred.scalar() or 0
            if pred_count >= p_count and pred_count > 0:
                check_ok(f"ML predictions synchronized: {pred_count} cached prediction snapshots.")
            elif pred_count > 0:
                check_ok(f"{pred_count} ML prediction(s) found in database.")
            else:
                check_warn(
                    "No ML predictions cached in database.",
                    "Run 'python seed_my_raw_projects.py' from backend directory."
                )
    except Exception as e:
        check_warn(f"Could not verify database seeds: {e}")


# ─── Main Summary ────────────────────────────────────────────────────────────
async def main():
    parser = argparse.ArgumentParser(description="LADRIS Environment Doctor & Diagnostic Tool")
    parser.add_argument("--fix", action="store_true", help="Automatically repair missing files, start Docker, and apply migrations")
    args = parser.parse_args()

    print(f"\n{BOLD}{CYAN}========================================================")
    print("   🩺 LADRIS — Developer Health Check & Diagnostic Tool")
    print(f"========================================================{RESET}")

    check_python_env()
    check_environment_file(auto_fix=args.fix)
    check_docker_status(auto_fix=args.fix)
    
    db_ok = await check_database(auto_fix=args.fix)
    ml_deps_ok = check_ml_dependencies()
    ml_art_ok = check_ml_artifacts()

    if ml_deps_ok and ml_art_ok:
        check_ml_live_inference()

    if db_ok:
        await check_db_seeds(auto_fix=args.fix)

    # Final Scorecard
    print(f"\n{BOLD}{CYAN}========================================================")
    print("   📋 DIAGNOSTIC SUMMARY")
    print(f"========================================================{RESET}")
    print(f"  Passed Checks: {GREEN}{passed_checks}{RESET} / {total_checks}")

    if warnings:
        print(f"  Warnings:      {YELLOW}{len(warnings)}{RESET}")
    if errors:
        print(f"  Failures:      {RED}{len(errors)}{RESET}")

    if not errors and not warnings:
        print(f"\n{BOLD}{GREEN}🎉 YOUR ENVIRONMENT IS 100% HEALTHY & READY TO CODE!{RESET}")
        print("To launch the application:")
        print(f"  1. Backend:  {CYAN}cd backend && uvicorn app.main:app --reload --port 8000{RESET}")
        print(f"  2. Frontend: {CYAN}cd frontend && npm run dev{RESET}\n")
    elif not errors:
        print(f"\n{BOLD}{GREEN}✔ Basic setup is functional with minor warnings.{RESET}")
        print("Address warnings above if you encounter unexpected behavior.\n")
    else:
        print(f"\n{BOLD}{RED}✘ Setup has issues that require attention.{RESET}")
        print(f"Run {CYAN}python doctor.py --fix{RESET} or follow the remediation tips listed above.\n")


if __name__ == "__main__":
    asyncio.run(main())
