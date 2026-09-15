# LADRIS
### AI-Powered Land Acquisition Early-Warning & Intervention Intelligence Platform

---

## 📌 Executive Summary

**LADRIS** is an enterprise-grade AI decision-support platform designed for predictive analytics and early detection of land acquisition delays in infrastructure development projects across India.

By analyzing administrative approval timelines, compensation disbursement rates, legal disputes, rehabilitation progress, and geospatial indicators, LADRIS shifts project monitoring from reactive reporting to predictive decision-making.

---

## 🏗️ Monorepo Architecture

```
LADRIS_AI/
├── frontend/          # React + TypeScript + Vite + Tailwind CSS + shadcn/ui
├── backend/           # Python + FastAPI + Async SQLAlchemy + Pydantic + JWT Auth
├── ml/                # ML Pipeline workspace & Data provenance registry
│   ├── data/          # raw/, processed/, features/
│   ├── notebooks/     # EDA & feature engineering notebooks
│   └── models/        # Serialized model artifacts
├── database/          # PostgreSQL + PostGIS schema migrations & index scripts
├── docs/              # System architecture, DB ERD, API specs & data strategy
├── docker-compose.yml # Container orchestration for DB, backend & frontend
└── .env.example       # Environment configuration template
```

---

## 🚀 Comprehensive Local Setup Guide

Follow these instructions to clone, configure, and run **LADRIS** from scratch on your local machine.

---

### 💻 Standard Setup Overview

| Component | Execution Method | Details |
| :--- | :--- | :--- |
| **Database** | **Docker** (`docker compose up -d db`) | PostGIS container on port `15432` with auto-schema migration |
| **Backend** | **Native Terminal** (`uvicorn`) | FastAPI server on `http://localhost:8000` with auto-reload |
| **Frontend** | **Native Terminal** (`npm run dev`) | React + Vite app on `http://localhost:5173` |
| **ML Engine** | **Native Terminal** (`python`) | Feature engineering & model training scripts |

---

### 🚀 Step-by-Step Launch Guide

#### Step 1: Clone Repository & Create `.env`
```bash
git clone https://github.com/SathvikaTalari/LADRIS---Land-Acquisition.git
cd LandPulse_AI

# Create .env file from template
cp .env.example .env    # Linux/macOS
Copy-Item .env.example .env   # Windows PowerShell
```

#### Step 2: Launch Database with Docker
Run Docker Compose to start only the PostgreSQL + PostGIS database container:
```bash
docker compose up -d db
```
> The container automatically initializes the `ladris` database schema, PostGIS extensions, and tables.

#### Step 3: Launch FastAPI Backend (Terminal 1)
```bash
cd backend

# Create & activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1   # Windows PowerShell
# source venv/bin/activate    # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Start backend development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Default Users Auto-Created: `admin@ladris.gov.in` / `officer@ladris.gov.in` (password: `admin123`)

#### Step 4: Launch React Frontend (Terminal 2)
Open a **new terminal window** and run:
```bash
cd frontend

# Install Node modules
npm install

# Start Vite dev server
npm run dev
```
- App UI: `http://localhost:5173`

#### Step 5: Run ML Pipeline & Tests (Terminal 3)
Open another terminal window for ML tasks:
```bash
# Re-train IsolationForest anomaly scorer
python ml/training/train.py

# Run unit & integration tests
pytest
```

---

### 🔑 Default System Access Credentials

When the backend starts up, default accounts are verified automatically:

| User Role | Email Address | Default Password |
| :--- | :--- | :--- |
| **Super Admin** | `admin@ladris.gov.in` | `admin123` |
| **Project Officer** | `officer@ladris.gov.in` | `admin123` |

---

### 🤖 ML Engine & Pipeline Execution

The ML engine provides **anomaly scoring**, **stage bottleneck detection**, **risk velocity calculation**, and **intervention recommendations** across land acquisition projects.

#### 1. Automatic Real-Time Inference
- **Zero-Config Execution**: The backend (`backend/app/services/anomaly_service.py` & `risk_engine.py`) automatically loads the pre-trained serialized model (`ml/models/isolation_forest_v1.0-anomaly_*.pkl`) on startup.
- In both Docker and Native setups, real-time risk scores and anomaly detection run automatically during API requests.

#### 2. Running Data Ingestion Scrapers (Collecting Real Data)
To ingest official projects from government portals:
```bash
# Docker Setup:
docker compose exec backend python /ml/data_ingestion/bhoomirashi_scraper.py
docker compose exec backend python /ml/data_ingestion/datagov_ingester.py

# Native Setup:
python ml/data_ingestion/bhoomirashi_scraper.py
python ml/data_ingestion/datagov_ingester.py
```

#### 3. Re-Training the ML Anomaly Scorer
To run feature engineering, data leakage checks, and train a new model artifact:
```bash
# Docker Setup:
docker compose exec backend python /ml/training/train.py

# Native Setup:
python ml/training/train.py
```
> The script validates prospective feature leakage, evaluates dataset sizes, trains an Isolation Forest model, normalizes anomaly scores, and updates `ml/models/current_model.json`.

#### 4. Exploratory Data Analysis & Notebooks
For interactive ML research and feature analysis:
```bash
# Install Jupyter inside backend virtual environment
pip install jupyter

# Launch notebook workspace
jupyter notebook ml/notebooks
```

---

## 🔑 Authentication & RBAC

LADRIS uses JWT tokens with standard Role-Based Access Control (RBAC):

| Role | Scope & Permissions |
| :--- | :--- |
| `SUPER_ADMIN` | Full system access, audit logs, dataset provenance management |
| `STATE_ADMIN` | State-wide project CRUD and administrative reporting |
| `DISTRICT_OFFICER` | Revenue district project creation and stage updates |
| `PROJECT_OFFICER` | Single project milestone tracking and event logging |
| `ANALYST` | Read-only analytics, custom query execution, model inspection |
| `VIEWER` | Read-only dashboard view scoped to assigned jurisdiction |

---

## 📜 Real Data Architecture Policy

LADRIS strictly mandates **data authenticity**:
- **No Fabricated Government Data**: Phase 1 includes zero fake government project statistics or dummy projects.
- **Data Provenance**: Every imported dataset is tracked in `ml/data_provenance.json` with source URL, organization, retrieval timestamp, and license.
- **Empty State System**: User interface components display clear, professional empty state indicators until official datasets are registered.

---

## 📖 System Documentation

Detailed technical documentation is available in the [`docs/`](./docs) directory:
- [Master AI Assistant Handoff & Implementation Tracker](./docs/implementation-tracking.md) ⭐
- [Architecture Specifications](./docs/architecture.md)
- [Model Card (v1.0-anomaly)](./docs/model-card.md)
- [Data Gap Report & Target Specification](./docs/data-gap-report.md)
- [ML Methodology & Stage Intelligence](./docs/ml-methodology.md)
- [Database Schema & ERD](./docs/database.md)
- [API Reference Guide](./docs/api.md)
- [Data Strategy & Provenance Standard](./docs/data-strategy.md)
