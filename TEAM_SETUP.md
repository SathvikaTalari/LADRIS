# 🛠️ LADRIS Team Setup & Troubleshooting Guide

> **Every time you clone this repo, run ONE command and you're done.**
> All database migrations, ML model loading, and demo data seeding happen automatically.

---

## ⚡ Quickstart (One Command)

### Windows (PowerShell)
```powershell
# From the LADRIS root folder:
.\setup_team.ps1
```

### Linux / macOS (Bash)
```bash
chmod +x ./setup_team.sh && ./setup_team.sh
```

The script will:
1. ✅ Check prerequisites (Python, Node, Docker)
2. ✅ Create `.env` from `.env.example`
3. ✅ Start the PostgreSQL + PostGIS Docker container
4. ✅ Wait for the DB to be healthy before continuing
5. ✅ Install Python packages in a virtual environment
6. ✅ Apply all DB migrations (creates tables, extensions, enums)
7. ✅ Load 25 demo projects + generate ML predictions
8. ✅ Install frontend npm packages
9. ✅ Run a full health check (`doctor.py`)

---

## 🔑 Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Super Admin** | `admin@ladris.gov.in` | `Password123!` |
| Central Ministry | `central@ladris.gov.in` | `Password123!` |
| State Authority | `state@ladris.gov.in` | `Password123!` |
| District Admin | `district@ladris.gov.in` | `Password123!` |
| LA Officer | `authority@ladris.gov.in` | `Password123!` |
| Project Agency | `agency@ladris.gov.in` | `Password123!` |
| Policy Maker | `policy@ladris.gov.in` | `Password123!` |

> 💡 On the login page, use the **"Select User Role"** dropdown to auto-fill credentials.

---

## 🚀 Starting the App (After Setup)

Open **two terminals**:

**Terminal 1 — Backend:**
```powershell
# Windows:
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```
```bash
# Linux / macOS:
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open: **http://localhost:5173**

---

## 🩺 Diagnosing Problems (`doctor.py`)

If something isn't working, run the automated diagnostics tool:

```bash
# From the backend folder with venv active:
python ../doctor.py
```

Or with auto-fix:
```bash
python ../doctor.py --fix
```

It checks 30+ things: DB connection, ML model files, Python packages, PostGIS extension, user accounts, etc.

---

## 🔧 Manual Step-by-Step (If Script Fails)

### Step 1 — Prerequisites
- **Docker Desktop** (for PostgreSQL + PostGIS): https://www.docker.com/products/docker-desktop/
- **Python 3.10, 3.11, or 3.12**: https://www.python.org/downloads/
- **Node.js 18+**: https://nodejs.org/

> ⚠️ Python 3.13 is NOT yet supported (some ML packages like LightGBM lag behind).

---

### Step 2 — Clone & Create `.env`

```bash
git clone <your-repo-url>
cd LADRIS

# Windows:
Copy-Item .env.example .env

# Linux/macOS:
cp .env.example .env
```

The `.env.example` already has all correct defaults for local dev. **No edits needed.**

---

### Step 3 — Start the Database

```bash
docker compose up -d db
```

This starts PostgreSQL + PostGIS on **port 15432** (not 5432, to avoid conflicts with any local Postgres you may have).

Wait ~20 seconds, then verify:
```bash
docker ps
# Should show: landpulse_db ... healthy
```

---

### Step 4 — Backend Setup

```bash
cd backend

# Windows:
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux/macOS:
python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

---

### Step 5 — Apply Migrations (CRITICAL)

```bash
# Still inside backend/ with venv active:
python run_migrations.py
```

This creates all tables, enables PostGIS + UUID extensions, creates demo user accounts, and registers data sources.

**Expected output:**
```
LADRIS — Automated Database Migration & Sync
[OK] Database connection verified.
[OK] Extension 'uuid-ossp' enabled.
[OK] Extension 'postgis' enabled.
[OK] Applied 001_initial_schema.sql
...
✅ All migrations and database checks completed successfully!
```

---

### Step 6 — Load Demo Projects & ML Predictions

```bash
# Still inside backend/ with venv active:
python seed_my_raw_projects.py
```

This loads the 25 demo projects from `land-delay-predictor/my_raw_projects.csv` and runs ML predictions for each.

---

### Step 7 — Frontend

```bash
cd ../frontend
npm install
npm run dev
```

---

## ❌ Common Problems & Fixes

---

### Problem: `Cannot connect to PostgreSQL` / `Connection refused`

**Fix 1 — Docker not running:**
```bash
docker compose up -d db
# Wait 30 seconds
docker ps  # check landpulse_db shows "healthy"
```

**Fix 2 — Wrong port in .env:**
The app uses port **15432** (Docker) by default. If you have a local Postgres on 5432, change your `.env`:
```env
POSTGRES_PORT=5432
```
And also create the database manually:
```sql
CREATE DATABASE ladris;
CREATE USER ladris_user WITH PASSWORD 'landpulse_pass';
GRANT ALL PRIVILEGES ON DATABASE ladris TO ladris_user;
```

---

### Problem: `relation "users" does not exist` or `relation "projects" does not exist`

You skipped migrations. Run:
```bash
cd backend
# (activate venv first)
python run_migrations.py
```

---

### Problem: `Invalid email or password` on login

The demo users are seeded during migrations and startup. If they're missing:
```bash
cd backend
# (activate venv first)
python run_migrations.py
# Restart the backend server
uvicorn app.main:app --reload --port 8000
```

Demo credentials: `admin@ladris.gov.in` / `Password123!`

---

### Problem: `ML model not found` or `Production ML model unavailable`

The ML model files are in `land-delay-predictor/models/`. These **are committed to git**, so they should be present after cloning. Verify:

```bash
# From LADRIS root:
ls land-delay-predictor/models/
# Should show folders like: 20260914_080620/
cat land-delay-predictor/models/latest.txt
# Should show the latest version folder name
```

If `land-delay-predictor/models/` is empty or missing:
```bash
# Check if the ML model folder was committed:
git log --oneline --all land-delay-predictor/models/
```

If the models folder wasn't committed, contact the repository owner to push the trained model artifacts.

---

### Problem: `PostGIS extension not available`

This happens when using a **non-Docker local PostgreSQL** that doesn't have PostGIS installed. Solutions:

**Option A (Recommended):** Use Docker — it includes PostGIS automatically:
```bash
docker compose up -d db
```

**Option B:** Install PostGIS for your local Postgres via StackBuilder (Windows) or:
```bash
# Ubuntu/Debian:
sudo apt-get install postgresql-16-postgis-3
```

> ⚠️ Without PostGIS, the GIS Map feature won't work, but all other features work fine.

---

### Problem: `uvicorn: command not found` or backend won't start

The virtual environment isn't activated. Run:
```bash
# Windows:
.\venv\Scripts\Activate.ps1

# Linux/macOS:
source venv/bin/activate

# Then:
uvicorn app.main:app --reload --port 8000
```

---

### Problem: Frontend shows blank page or API errors

1. Confirm backend is running: http://localhost:8000/health
2. Check `.env` in project root has `VITE_API_BASE_URL=http://localhost:8000`
3. Check there's no `frontend/.env` overriding this
4. Restart the frontend: `npm run dev`

---

### Problem: `bcrypt` / `passlib` version conflict

```bash
pip install --upgrade bcrypt passlib[bcrypt]
```

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `.env.example` | Template with all defaults for local dev |
| `.env` | Your actual config (never commit this) |
| `backend/run_migrations.py` | Creates DB schema, extensions, demo users |
| `backend/seed_my_raw_projects.py` | Loads projects + ML predictions |
| `doctor.py` | 30+ health checks for diagnosis |
| `setup_team.ps1` | Windows one-click setup |
| `setup_team.sh` | Linux/macOS one-click setup |
| `land-delay-predictor/models/` | Trained LightGBM model artifacts |
| `land-delay-predictor/my_raw_projects.csv` | Demo project input data |

---

## 🆘 Still Stuck?

Run the full diagnostics and share the output with your team lead:
```bash
cd backend
python ../doctor.py > doctor_report.txt 2>&1
# Share doctor_report.txt
```
