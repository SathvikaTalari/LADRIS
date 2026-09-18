# 🛠️ LADRIS — Team Onboarding & Troubleshooting Guide
### Database & ML Model Connectivity in Integrated GitHub Development

This guide is for all team members collaborating on the **LADRIS** repository. It explains how the database and ML delay prediction models work together, and provides step-by-step solutions to common setup issues.

---

## 🧭 Architecture at a Glance

A frequent point of confusion is how the components communicate. **LADRIS is designed as a unified system:**

```mermaid
graph TD
    UI["💻 Frontend (React + Vite)\nhttp://localhost:5173"] -->|"REST API (port 8000)"| Backend["⚡ Backend (FastAPI)\nhttp://localhost:8000"]
    
    subgraph "In-Process Backend Memory"
        Backend --> Service["app.services.production_ml_service"]
        Service --> ML_Inference["app.ml.inference\n(LightGBM + SHAP Explainer)"]
        ML_Inference --> Artifacts["models/latest.txt\nclassifier.joblib\nregressor.joblib"]
    end

    Backend -->|"AsyncPG / SQLAlchemy\n(host: localhost, port: 15432 or 5432)"| DB[("🗄️ PostgreSQL + PostGIS\nDatabase: ladris")]
```

> [!IMPORTANT]
> **Key Architecture Rules:**
> 1. **Do NOT run a separate server for the ML model.** The ML model is **directly embedded in-process** into the FastAPI backend. You only need to run the Backend and the Frontend.
> 2. **Default Database Port is `15432`**: The Docker container maps `15432 -> 5432` to avoid conflicts with any local PostgreSQL instance you might already have running on port `5432`.
> 3. **Run `python doctor.py` at any time** from the repository root to automatically inspect your environment and identify exact issues.

---

## ⚡ 1-Minute Quick Start

If you have **Docker Desktop**, **Python 3.10–3.12**, and **Node.js 18+** installed:

### Windows (PowerShell):
```powershell
.\setup_team.ps1
```

### Linux / macOS (Terminal):
```bash
chmod +x ./setup_team.sh && ./setup_team.sh
```

This single command:
1. Creates `.env` from `.env.example` (if not present).
2. Starts the PostGIS database container (`landpulse_db`) on port `15432`.
3. Creates the Python virtual environment and installs all dependencies.
4. Applies all database migrations (001 through 012) and enables PostGIS.
5. Ingests the 25 verified projects from `my_raw_projects.csv` and computes initial ML delay risk predictions.
6. Installs frontend npm packages.
7. Runs the **Doctor Diagnostic Tool** and displays a health scorecard.

---

## 🗄️ Database Connecting & Fetching: Solutions & Options

### Option A: Docker Database (Default & Recommended)

1. Ensure **Docker Desktop** is open and running.
2. Start the database container:
   ```bash
   docker compose up -d db
   ```
3. Verify the container is running:
   ```bash
   docker ps --filter "name=landpulse_db"
   ```
   You should see `0.0.0.0:15432->5432/tcp`.

---

### Option B: Using a Native Local PostgreSQL (Port 5432)

If you cannot run Docker Desktop (e.g. virtualization disabled or corporate restrictions):

1. **Create the database and user** in PostgreSQL:
   ```sql
   CREATE DATABASE ladris;
   CREATE USER ladris_user WITH PASSWORD 'landpulse_pass';
   GRANT ALL PRIVILEGES ON DATABASE ladris TO ladris_user;
   \c ladris
   GRANT ALL ON SCHEMA public TO ladris_user;
   ```
2. **Install PostGIS Extension**:
   - **Windows**: Run StackBuilder (bundled with PostgreSQL installer) and select **Spatial Extensions -> PostGIS**.
   - **Ubuntu/Debian**: `sudo apt-get install postgresql-postgis`
   - **macOS**: `brew install postgis`
   - In PostgreSQL:
     ```sql
     \c ladris
     CREATE EXTENSION IF NOT EXISTS postgis;
     CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
     ```
3. **Update your `.env` file**:
   ```ini
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=ladris
   POSTGRES_USER=ladris_user
   POSTGRES_PASSWORD=landpulse_pass
   ```
4. **Apply all migrations**:
   ```bash
   cd backend
   python run_migrations.py --seed-projects
   ```

---

### Option C: Using Free Cloud PostgreSQL (Neon / Supabase / Aiven)

If you don't want to install Docker or PostgreSQL locally:

1. Create a free PostgreSQL database on [Neon.tech](https://neon.tech) or [Supabase.com](https://supabase.com).
2. Enable PostGIS in their dashboard (e.g. in Supabase SQL editor: `CREATE EXTENSION IF NOT EXISTS postgis;`).
3. Set your connection string in `.env`:
   ```ini
   DATABASE_URL=postgresql+asyncpg://user:password@ep-xyz.neon.tech/neondb?ssl=require
   SYNC_DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/neondb?ssl=require
   ```
4. Run migrations:
   ```bash
   cd backend && python run_migrations.py --seed-projects
   ```

---

### Common Database Errors & Fixes

| Error Message | Cause | Solution |
| :--- | :--- | :--- |
| `connection to server at "localhost", port 15432 failed: Connection refused` | Docker is stopped or container not started | Open Docker Desktop and run `docker compose up -d db`. If using native Postgres, change port in `.env` to `POSTGRES_PORT=5432`. |
| `password authentication failed for user "ladris_user"` | Credentials in `.env` do not match the database | Default credentials are `ladris_user` and `landpulse_pass`. If using native Postgres, either create `ladris_user` or update `.env` with your `postgres` user & password. |
| `database "ladris" does not exist` | Database has not been created | Run `docker compose up -d db` (auto-creates `ladris`) or run `CREATE DATABASE ladris;` in psql. |
| `type "geometry" does not exist` | PostGIS extension is missing in PostgreSQL | Use the Docker image (`postgis/postgis`) which has PostGIS pre-installed, or run `CREATE EXTENSION postgis;` in your PostgreSQL instance. |
| `relation "project_interventions" does not exist` | Migrations not applied to your volume | Run `python backend/run_migrations.py`. This executes all migrations 001–012 safely and idempotently. |
| Dashboards are completely empty (0 projects) | Data has not been seeded | Run `cd backend && python seed_my_raw_projects.py`. |

---

## 🧠 ML Model Fetching & Connecting: Solutions & Details

### 1. The In-Process Architecture

In this repository, you will find a folder named `land-delay-predictor`. 
- **Do NOT run `uvicorn` inside `land-delay-predictor`!**
- The main LADRIS backend (`backend/app/main.py`) directly imports the ML inference code via:
  ```python
  from app.services.production_ml_service import warm_production_model, generate_prediction
  ```
- All predictions, SHAP explanations, and scenario simulations run directly inside the backend process on port `8000`.

---

### 2. Dependency Installation Pitfalls (Windows / Mac)

The ML pipeline requires `lightgbm>=4.5.0`, `shap>=0.42.0`, `scikit-learn`, `joblib`, and `pandas`.

#### On Windows:
If `pip install shap` fails with `Microsoft Visual C++ 14.0 or greater is required`:
- **Fix 1 (Instant)**: Install the pre-compiled binary wheel:
  ```powershell
  pip install --only-binary=:all: shap lightgbm
  ```
- **Fix 2**: If using Python 3.13, downgrade your virtual environment to Python 3.11 or 3.12 where all binary wheels are pre-built.

#### On macOS (Apple Silicon M1 / M2 / M3):
If backend startup fails with `Library not loaded: ... libomp.dylib`:
- **Fix**: Install the OpenMP runtime via Homebrew:
  ```bash
  brew install libomp
  ```

---

### 3. Model Artifact Verification

Backend looks for model files at `land-delay-predictor/models/`:
1. `models/latest.txt` (Contains the active version, e.g. `20260914_080620`)
2. `models/<version>/classifier.joblib` (Calibrated LightGBM Classifier)
3. `models/<version>/regressor.joblib` (Delay Duration Regressor)
4. `models/<version>/metadata.json` (Training metadata & feature schema)

To verify that the model loads properly, run:
```bash
python doctor.py
```
Or test in Python:
```bash
cd backend
python -c "from app.services.production_ml_service import warm_production_model; print(warm_production_model())"
```

---

## 🩺 The Developer Health Check Tool: `doctor.py`

Whenever something isn't working, run:

```bash
python doctor.py
```

### What it checks:
- [x] Python version & virtual environment
- [x] `.env` existence & variable syntax
- [x] Docker daemon & container status
- [x] PostgreSQL port availability & SQLAlchemy connection
- [x] PostGIS and UUID extension installation
- [x] Applied migrations (001 to 012)
- [x] Machine learning packages (`lightgbm`, `shap`, `sklearn`, `joblib`, `pandas`, `numpy`)
- [x] ML model artifact integrity (`latest.txt`, `.joblib`, `metadata.json`)
- [x] Live end-to-end ML inference test (latency in ms)
- [x] Database project seeds & prediction cache

### Auto-Repair Flag:
Run with `--fix` to automatically create missing `.env` files, start Docker containers, apply missing migrations, and seed projects:
```bash
python doctor.py --fix
```

---

## 🌿 Git & Collaboration Best Practices

1. **Never commit `.env`**: Always keep credentials local. If you add a new configuration parameter, add it to `.env.example`.
2. **When pulling changes from GitHub**:
   ```bash
   git pull origin main
   # Apply any newly committed migrations:
   cd backend && python run_migrations.py
   ```
3. **If new ML models are trained**:
   Make sure the `models/<version>/` directory and `models/latest.txt` are committed to Git so teammates receive the updated model bundle.
