# Land Acquisition Delay Predictor (SIH 25017)

> **💡 LADRIS Integration Note for Team Members**:
> In this integrated repository, this ML module is **directly embedded in-process** into the main LADRIS backend (`backend/app/services/production_ml_service.py`).
> **You do NOT need to run this sub-project as a standalone server on port 8000** (which would conflict with the main backend). The main backend handles ML predictions, SHAP explanations, and model loading automatically. Run `python doctor.py` at the repo root to verify that your ML environment is healthy.

## Overview


An AI-powered decision support system that ingests land acquisition project data from multiple sources, trains ML models to predict delay risk, and provides actionable insights for proactive governance.

## Architecture

```
┌─ Ingestion Connectors ─────────────────────────────────────────────────────┐
│   REST API ─┐  Database ─┐  CSV/XLSX ─┐  Manual Upload ─┐  Webhook ─┐     │
│             │           │            │                 │          │     │
│   pulls raw records from external systems, files, or manual uploads      │
└─► Staging Layer (raw_records table) ─► ETL Pipeline ─► Canonical Schema  │
                                                                             │
┌─ ML Pipeline ──────────────────────────────────────────────────────────────┐
│   Feature Engineering ──► Model Training ──► Risk Scoring ──► SHAP       │
│   Explanations                                                    Alerts  │
│                                                                           │
└─► PostgreSQL Database ─► FastAPI REST API ─► Interactive Dashboards        │
                                                                             │
```

## ML Model Capabilities

### 1. Project-level Delay Prediction
- **Binary Classifier**: Predicts probability of project delay (0-100 risk score)
- **Delay Duration Regressor**: Predicts number of delay days (for delayed projects)
- **SHAP Explanations**: Identifies top delay drivers per project

### 2. Stage-specific Risk Scoring
The system predicts delay risk at each lifecycle stage:
- NOTIFICATION → SURVEY → APPROVAL → COMPENSATION → LEGAL_RESOLUTION → REHABILITATION → POSSESSION → COMPLETED

For each stage, the system computes:
- Stage tenure (days in current stage)
- Stage overdue status and overdue days
- Stage-specific risk scores

### 3. Risk Categories
- **HIGH (70-100)**: Requires immediate intervention
- **MEDIUM (40-79)**: Monitor closely, corrective actions recommended
- **LOW (0-39)**: Track regularly

### 4. Key Delay Drivers
- Pending approvals
- Legal disputes
- Compensation disbursement delays
- Rehabilitation progress
- District/agency historical delay rates
- Stakeholder responsiveness
- Land area and affected families

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ingest/file` | POST | Upload CSV/XLSX project data |
| `/ingest/manual` | POST | Auth-gated manual upload |
| `/model/train` | POST | Train models from canonical data |
| `/model/predict` | POST | Score all projects |
| `/model/evaluate` | POST | Run full evaluation |
| `/model/retrain` | POST | Continuous learning trigger |
| `/model/status` | GET | Check if retraining needed |
| `/model/versions` | GET | List all model versions |
| `/dashboard/summary` | GET | High-level dashboard data |
| `/dashboard/trends` | GET | District/state delay trends |
| `/dashboard/gis-projects` | GET | GIS-ready project coordinates |
| `/projects/{id}/risk` | GET | Project-specific risk score |
| `/projects/{id}/alerts` | GET | Alerts for a project |
| `/stage-risks` | GET | Per-stage risk scores |
| `/alerts/summary` | GET | Alert overview |
| `/alerts/all` | GET | All alerts (default threshold 70) |

## Setup & Connection Architecture

`land-delay-predictor` operates in two modes:

### 1. Integrated Mode (Standard LADRIS Application)
When running the main LADRIS application (`backend` + `frontend`):
- The FastAPI backend (`c:\Ladris\LADRIS\backend`) connects directly to `land-delay-predictor/app/ml/inference.py` in-process.
- Trained LightGBM model bundles are automatically loaded from `land-delay-predictor/models/` at startup.
- All predictions, stage breakdowns, and SHAP explanations are served on `http://localhost:8000/api/ml/` and consumed by the React UI (`http://localhost:5173`).
- **No separate ML server process is required** when running the main application!

### 2. Standalone Mode (Dedicated ML Pipeline & Ingestion API)
If you wish to run `land-delay-predictor` as an independent microservice or run local data ingestion, ETL, and model retraining pipelines:

#### Windows PowerShell:
```powershell
# 1. Navigate to land-delay-predictor
cd land-delay-predictor

# 2. Activate virtual environment
.\venv\Scripts\Activate.ps1
# (or invoke directly via .\venv\Scripts\python)

# 3. Environment configuration
# The .env file in this directory is pre-configured for the running PostGIS container on port 15432:
# DATABASE_URL=postgresql+psycopg2://ladris_user:landpulse_pass@localhost:15432/land_delay
# To override in PowerShell:
# $env:DATABASE_URL="postgresql+psycopg2://ladris_user:landpulse_pass@localhost:15432/land_delay"

# 4. Initialize database schema
python -m app.db.init_db

# 5. Start standalone ML API server (run on port 8001 to avoid port 8000 backend collision)
uvicorn app.api.main:app --reload --port 8001
```

#### Linux / macOS:
```bash
# 1. Activate virtual environment
source venv/bin/activate

# 2. Set database URL (or use .env file)
export DATABASE_URL="postgresql+psycopg2://ladris_user:landpulse_pass@localhost:15432/land_delay"

# 3. Initialize database
python -m app.db.init_db

# 4. Start standalone ML API server
uvicorn app.api.main:app --reload --port 8001
```

## Local Docker Deployment (PostgreSQL + PostGIS)

If running the containerized database from the LADRIS root:
```bash
# From LADRIS root:
docker compose up -d db
# Starts PostGIS on port 15432 with ladris and land_delay databases

# Ingest sample seed and run ETL:
curl -X POST "http://localhost:8001/ingest/file?source_name=district_admin_monthly_export" \
     -F "file=@data/sample_seed/sample_projects.csv"
curl -X POST "http://localhost:8001/etl/run"
curl -X POST "http://localhost:8001/model/train"

# Get predictions
curl -X POST "http://localhost:8001/model/predict"
```

## Data Sources

The system accepts data from multiple sources:
- **REST APIs**: Scheduled or on-demand pulls via configuration
- **Database connections**: Read-only access to agency databases
- **CSV/XLSX files**: Upload or automated drop directories
- **Webhooks**: Future real-time event ingestion
- **Manual uploads**: Auth-gated administrator uploads

## Schema Configuration

Each data source requires a YAML config under `config/sources/`:
```yaml
source_name: "my_council_data"
connector_type: "file"  # or "rest_api", "database", "webhook"
schedule_interval_minutes: 43200  # optional: auto-poll every ~monthly
# ... field mapping and connection details
```

## Model Persistence

Models are saved to `models/<version>/` with:
- `classifier.joblib` - Binary delay classifier
- `regressor.joblib` - Delay duration regressor (if trained)
- `metadata.json` - Feature columns, categorical columns, evaluation metrics

## Continuous Learning

The system supports:
- Model drift detection
- Retraining triggers based on:
  - New project data volume
  - Model age (default 30 days)
  - Prediction drift detection
- Version history with full metadata

## Project Structure

```
app/
├── db/
│   ├── __init__.py
│   ├── init_db.py      # Database initialization
│   ├── schema.py       # SQLAlchemy ORM models
│   └── staging.py      # Raw record storage
├── ingestion/
│   ├── __init__.py
│   ├── base.py         # Connector base class
│   ├── rest_connector.py
│   ├── db_connector.py
│   ├── file_connector.py
│   ├── scheduler.py
│   └── webhook_connector.py
├── etl/
│   └── pipeline.py     # Staging -> canonical transform
├── ml/
│   ├── __init__.py
│   ├── features.py     # Feature engineering
│   ├── train.py        # Model training
│   ├── predict.py      # Risk scoring
│   ├── stage_predictor.py  # Stage-specific prediction
│   ├── evaluation.py   # Metrics & validation
│   ├── continuous_learning.py
│   ├── alerts.py       # Alert generation
│   └── model_store.py  # Model versioning
├── api/
│   └── main.py         # FastAPI endpoints
└── tests/
config/
data/
requirements.txt
```

## Sample Seed Data

`data/sample_seed/sample_projects.csv` contains 20 sample projects for testing the full pipeline. It demonstrates:
- Multiple project types (highway, railway, irrigation, industrial)
- Various implementing agencies (NHAI, Indian Railways, State PWD, etc.)
- Different states and districts
- Mix of delayed and on-time projects
- Legal disputes and rehabilitation data