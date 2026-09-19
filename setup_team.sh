#!/usr/bin/env bash
# =============================================================================
# LADRIS — One-Click Team Setup Script (Linux / macOS)
# Run from the project root: chmod +x setup_team.sh && ./setup_team.sh
# =============================================================================
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo -e "\n========================================================"
echo -e "   LADRIS — Automated Team Onboarding Setup"
echo -e "========================================================\n"

# ─── Prerequisites Check ──────────────────────────────────────────────────────
echo "[0/6] Checking prerequisites..."
MISSING=()
command -v python3 >/dev/null 2>&1 || MISSING+=("python3")
command -v node >/dev/null 2>&1 || MISSING+=("node")
command -v npm >/dev/null 2>&1 || MISSING+=("npm")
if [ ${#MISSING[@]} -gt 0 ]; then
    echo "   [ERROR] Missing required tools: ${MISSING[*]}"
    echo "           Install them and re-run this script."
    exit 1
fi
echo "   [OK] python3, node, npm found."

# ─── Step 1: Environment File ─────────────────────────────────────────────────
echo -e "\n[1/6] Setting up environment file..."
if [ ! -f "$REPO_ROOT/.env" ]; then
    cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
    echo "   [OK] .env created from .env.example."
else
    echo "   [OK] .env already exists."
fi

# ─── Step 2: Start PostGIS DB Container ──────────────────────────────────────
echo -e "\n[2/6] Starting PostGIS database container..."
if docker info >/dev/null 2>&1; then
    docker compose up -d db
    echo "   [OK] Docker container started. Waiting for PostgreSQL to be ready..."

    # Wait for DB to be healthy (up to 60 seconds)
    MAX_WAIT=60
    WAITED=0
    DB_READY=false
    while [ $WAITED -lt $MAX_WAIT ]; do
        STATUS=$(docker inspect --format='{{.State.Health.Status}}' landpulse_db 2>/dev/null || echo "unknown")
        if [ "$STATUS" = "healthy" ]; then
            DB_READY=true
            break
        fi
        sleep 3
        WAITED=$((WAITED + 3))
        echo "   ... waiting for database ($WAITED/$MAX_WAIT s)"
    done

    if [ "$DB_READY" = "true" ]; then
        echo "   [OK] PostgreSQL is ready on port 15432."
    else
        echo "   [WARN] DB health check timed out. Proceeding in 5s..."
        sleep 5
    fi
else
    echo "   [WARN] Docker not running. If you have local Postgres on port 5432, it will be used."
    echo "          For full PostGIS + GIS map support, install Docker Desktop and re-run."
fi

# ─── Step 3: Python Virtual Environment & Dependencies ───────────────────────
echo -e "\n[3/6] Setting up Python virtual environment & dependencies..."
cd "$REPO_ROOT/backend"
if [ ! -d "venv" ]; then
    echo "   Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
echo "   Installing Python packages (this may take 2-3 minutes on first run)..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo "   [OK] Python dependencies installed."

# ─── Step 4: Database Migrations & Schema Sync ───────────────────────────────
echo -e "\n[4/6] Running database migrations & schema synchronization..."
cd "$REPO_ROOT/backend"
if ! python run_migrations.py; then
    echo "   [ERROR] Migration failed!"
    echo "           Check that your database container is running: docker compose up -d db"
    echo "           Then re-run: ./setup_team.sh"
    exit 1
fi
echo "   [OK] Database schema & PostGIS extensions verified."

# ─── Step 5: Load Projects & Generate ML Predictions ─────────────────────────
echo -e "\n[5/6] Loading projects from CSV & generating ML predictions..."
cd "$REPO_ROOT/backend"
python seed_my_raw_projects.py || echo "   [WARN] Seeding had issues. Re-run seed_my_raw_projects.py after fixing DB."
echo "   [OK] Projects loaded and ML predictions generated."

# ─── Step 6: Frontend npm Dependencies ───────────────────────────────────────
echo -e "\n[6/6] Checking frontend npm dependencies..."
cd "$REPO_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    echo "   Installing npm packages..."
    npm install
fi
echo "   [OK] Frontend is ready."

cd "$REPO_ROOT/backend"

# ─── Doctor Health Check ─────────────────────────────────────────────────────
echo -e "\n[*] Running environment health check..."
python "$REPO_ROOT/doctor.py" 2>&1 | head -40

cd "$REPO_ROOT"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo -e "\n========================================================"
echo -e "   [SUCCESS] LADRIS Setup Complete!"
echo -e "========================================================"
echo -e "\nTo start the application, open TWO terminal windows:\n"
echo -e "  Terminal 1 — Backend:"
echo -e "    cd backend && source venv/bin/activate"
echo -e "    uvicorn app.main:app --reload --port 8000\n"
echo -e "  Terminal 2 — Frontend:"
echo -e "    cd frontend && npm run dev\n"
echo -e "  Browser URL  : http://localhost:5173"
echo -e "  Demo Login   : admin@ladris.gov.in  /  Password123!"
echo -e ""
echo -e "  Trouble?     : cd backend && python ../doctor.py"
echo -e ""
