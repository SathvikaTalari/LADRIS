#!/usr/bin/env bash
# =============================================================================
# LADRIS — One-Click Team Setup Script (Linux / macOS)
# =============================================================================
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo -e "\n========================================================"
echo -e "   🛣️  LADRIS — Automated Team Onboarding Setup"
echo -e "========================================================\n"

# 1. Environment file setup
if [ ! -f "$REPO_ROOT/.env" ]; then
    echo -e "[1/5] Creating root .env from .env.example..."
    cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
    echo -e "   [OK] .env created."
else
    echo -e "[1/5] Root .env already exists."
fi

# 2. Database container check
echo -e "\n[2/5] Starting PostGIS database container (landpulse_db)..."
docker compose up -d db || echo "   [WARN] Docker command failed or Docker is not running. If you have local Postgres, that will be used."

# 3. Backend virtual environment & dependencies
echo -e "\n[3/5] Setting up Backend Python virtual environment..."
cd "$REPO_ROOT/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo -e "   [OK] Backend dependencies installed."

# 4. Sync my_raw_projects.csv and generate ML delay predictions
echo -e "\n[4/5] Loading 25 projects from my_raw_projects.csv & generating ML predictions..."
python seed_my_raw_projects.py
echo -e "   [OK] ML predictions & SHAP explanations synchronized."

# 5. Frontend dependencies
echo -e "\n[5/5] Checking Frontend npm dependencies..."
cd "$REPO_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    npm install
fi
echo -e "   [OK] Frontend ready."

cd "$REPO_ROOT"

echo -e "\n========================================================"
echo -e "   [SUCCESS] LADRIS Environment Setup Complete!"
echo -e "========================================================"
echo -e "\nTo start the application:"
echo -e "  Terminal 1 (Backend):"
echo -e "    cd backend && source venv/bin/activate"
echo -e "    uvicorn app.main:app --reload --port 8000\n"
echo -e "  Terminal 2 (Frontend):"
echo -e "    cd frontend"
echo -e "    npm run dev\n"
echo -e "Open your browser at: http://localhost:5173"
echo -e "Login credentials: select any role from the dropdown (e.g. Super Admin or District Officer)!\n"
