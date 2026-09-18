# 🛣️ LADRIS
### **AI-Powered Land Acquisition Early-Warning & Decision Support Intelligence Platform**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20PostGIS-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat-square&logo=python)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## 📌 Executive Summary

**LADRIS** (Land Acquisition Decision & Risk Intelligence System) is an enterprise AI decision-support platform designed for predictive analytics and proactive delay prevention across Indian infrastructure and National Highway projects.

Linear infrastructure development across India frequently faces multi-year delays due to statutory notification lapses, compensation distribution bottlenecks, court disputes, and Right-of-Way (RoW) encumbrances. LADRIS transforms this paradigm from **reactive tracking** into **predictive early intervention** by continuously auditing real gazettes, court filings, and milestone progress.

---

## 🌟 Core Features & Modules

| Module | Route | What it Does |
| :--- | :--- | :--- |
| **🤖 Saarthi AI Copilot** | *Floating in all screens* | In-app intelligent conversational assistant grounded in live database metrics, statutory land laws (NH Act 1956 & RFCTLARR 2013), with speech-to-text and voice narration. |
| **📊 Command Dashboard** | `/dashboard` | Executive KPI overview displaying total verified projects, delayed corridors, high-risk counts, and the priority intervention queue. |
| **🎯 Priority Intelligence** | `/priority-intelligence` | Multi-factor decision-support ranking engine that explains *why* each corridor is prioritized based on timeline slippage, statutory lapse proximity, and legal bottlenecks. |
| **🏛️ LA Officer Workbench** | `/la-workbench` | Operational dashboard for CALA (Competent Authority for Land Acquisition) officers to manage 3A/3D/3G notifications, objection hearings, and compensation disbursement. |
| **🚜 Implementing Agency Portal** | `/agency-portal` | Project execution hub for NHAI and state agencies to monitor civil contractor handovers and encumbrance-free physical possession. |
| **🧪 What-If Policy Simulator** | `/intelligence` | Simulation sandbox allowing planners to model how allocating special arbitration budgets or faster disbursement compresses project delay months. |
| **🗺️ GIS Geospatial Risk Map** | `/gis` | Interactive PostGIS map showing highway alignment pins with colored risk tiers (Critical, High, Medium, Low) and strict zero-hallucination coordinates. |
| **📈 District Analytics** | `/analytics` | Aggregated district and state distributions with sample-size safeguards. |
| **🚨 Early-Warning Alerts** | `/alerts` | Automated triggers warning of impending statutory lapse cliffs (e.g. 1-year Section 3D deadline). |
| **🔗 Data Sources & Quality** | `/data-sources` | Pipeline health monitor for BhoomiRashi gazette scrapers, Data.gov.in, and e-Courts case feeds. |

---

## 🏗️ Monorepo Architecture

```
LADRIS/
├── frontend/             # React 19 + TypeScript + Vite + Zustand + Framer Motion
│   ├── src/
│   │   ├── api/          # Axios API client with automatic JWT token refresh
│   │   ├── components/   # UI components (Layout, Chatbot, Voice, Charts)
│   │   ├── pages/        # Dashboard, GIS, Workbench, Analytics, Intelligence
│   │   └── store/        # Zustand state stores (Auth, Theme)
├── backend/              # FastAPI + Async SQLAlchemy + Pydantic v2 + JWT
│   ├── app/
│   │   ├── api/v1/       # REST API endpoints (Projects, Intelligence, Chatbot, Alerts)
│   │   ├── models/       # PostgreSQL models (Project, Alert, User, DataSource)
│   │   ├── services/     # Business logic (Saarthi chatbot, Anomaly scoring, Audit)
│   │   └── etl/          # BhoomiRashi scraper and data normalizer
├── database/             # PostgreSQL + PostGIS migrations and seed scripts
│   └── migrations/       # SQL schema versions (001 to 006)
├── ml/                   # Machine learning training, features, and model cards
│   ├── models/           # Serialized IsolationForest model artifacts (.pkl)
│   └── training/         # Model training scripts and validation
├── docs/                 # Detailed architectural and domain documentation
└── docker-compose.yml    # Docker configuration for PostgreSQL + PostGIS
```

---

## ⚡ Quick Start Guide (Run in 3 Minutes)

### 📋 Prerequisites
- **Git** installed
- **Docker Desktop** (for PostgreSQL + PostGIS database)
- **Python 3.10+**
- **Node.js 18+** & `npm`

---

### 🚀 One-Click Automated Team Setup (Fastest)

Run the automated setup script from the root `LADRIS` directory. It configures `.env`, starts the PostGIS database, installs all Python & npm dependencies, and loads the 25 projects with pre-computed ML predictions automatically:

```powershell
# Windows PowerShell:
.\setup_team.ps1
```

```bash
# Linux / macOS:
chmod +x ./setup_team.sh && ./setup_team.sh
```

> 🩺 **Team Troubleshooting**: Facing database or ML model errors?
> Run `python doctor.py` (or `python doctor.py --fix`) for instant automated diagnosis. See the [Team Onboarding & Troubleshooting Guide](docs/TEAM_ONBOARDING_AND_TROUBLESHOOTING.md) for full details on Docker, native PostgreSQL, and ML dependencies.

---

### 🛠️ Manual Step-by-Step Setup

### Step 1: Clone the Repository & Configure Environment

```bash
git clone https://github.com/SathvikaTalari/LADRIS.git
cd LADRIS

# Copy the environment file template
# Windows PowerShell:
Copy-Item .env.example .env

# Linux / macOS:
cp .env.example .env
```

---

### Step 2: Start the PostGIS Database Container

```bash
docker compose up -d db
```
> This starts PostgreSQL with the PostGIS extension on port `15432` with auto-initialized schemas.

---

### Step 3: Setup & Start Backend (Terminal 1)

```bash
cd backend

# Create and activate Python virtual environment
# Windows:
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux / macOS:
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Sync projects from my_raw_projects.csv and generate ML predictions:
python seed_my_raw_projects.py

# Start the FastAPI development server with hot-reload
uvicorn app.main:app --reload --port 8000
```
- **Backend API URL**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`

---

### Step 4: Setup & Start Frontend (Terminal 2)

Open a new terminal window:

```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
- **Web Application URL**: `http://localhost:5173`

---

## 🔑 Demo Access Credentials

The platform includes pre-configured demo credentials representing every stakeholder role in the land acquisition lifecycle:

| Stakeholder Role | Email Address | Password | Jurisdiction Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@ladris.gov.in` | `Password123!` *(or `admin123`)* | Full System Admin |
| **Central Ministry (MoRTH)** | `central@ladris.gov.in` | `Password123!` | National Highway Network |
| **State Government** | `state@ladris.gov.in` | `Password123!` | State Revenue & PWD |
| **District Administration** | `district@ladris.gov.in` | `Password123!` | District Collectorate |
| **Land Acquiring Authority (CALA)** | `authority@ladris.gov.in` | `Password123!` | Land Acquisition Hearings |
| **Land Requiring Body** | `lrb@ladris.gov.in` | `Password123!` | Infrastructure Project Sponsor |
| **Project Implementing Agency** | `agency@ladris.gov.in` | `Password123!` | NHAI / NHIDCL Execution |
| **Policy Maker** | `policy@ladris.gov.in` | `Password123!` | NITI Aayog / MoRTH Research |

> 💡 **Quick Login**: On the login screen (`http://localhost:5173/login`), simply select any role from the **"Select User Role"** dropdown. It will automatically populate the demo email and password for you!

---

## 🤖 Saarthi — In-App AI Assistant

**Saarthi** is your interactive decision copilot built into the bottom-right of every screen:

- 💬 **Live Database Queries**: Ask *"Which projects have the highest delay risk?"* or *"Tell me about the Sangareddy Bypass"* and Saarthi will query the live 250 corridors and generate a summarized table.
- 📜 **Statutory Law Guidance**: Ask about the **National Highways Act 1956** (Sections 3A to 3H) or **RFCTLARR Act 2013** (solatium and market value calculations).
- 🧭 **In-App Action Buttons**: Every reply contains direct navigation links (e.g. `[Open GIS Map]`, `[Priority Queue]`) that route inside the app without reloading.
- 🎙️ **Voice Accessibility**: Includes a microphone button for voice queries (Speech-to-Text) and a speaker toggle for audio narration (Text-to-Speech).

---

## ⚖️ Statutory Land Acquisition Framework

LADRIS directly tracks the statutory stages defined under Indian law:

### 1. National Highways Act, 1956
```
Section 3A (Intention to Acquire)
      ↓ (21 Days for Objections)
Section 3C (Hearing of Objections by CALA)
      ↓ ⚠️ MUST BE PUBLISHED WITHIN 1 YEAR, OR 3A LAPSES!
Section 3D (Declaration of Acquisition - Land Vests in Govt)
      ↓
Section 3G (Determination of Compensation by CALA)
      ↓ (Dispute? → Arbitration by Divisional Commissioner)
Section 3H (Deposit of Compensation with CALA)
      ↓ (60 Days Notice)
Section 3E (Enforcing Physical Possession of Right-of-Way)
```

### 2. RFCTLARR Act, 2013
- **Market Value**: Higher of circle rate or average of top 50% sale deeds over past 3 years.
- **Solatium**: Mandatory **100% additional amount** added to the market value.
- **Rural Multiplication Factor**: Between **1.0x and 2.0x** based on distance from urban zones.
- **Interest**: **12% per annum** from notification to award date.

---

## 🧪 Testing & Code Quality

### Backend Tests
```bash
cd backend
venv\Scripts\activate
pytest
```

### Frontend Type Check
```bash
cd frontend
npx tsc --noEmit
```

### Verify Saarthi AI Endpoint
```bash
# In backend virtual environment:
python -c "import urllib.request, json; print(urllib.request.urlopen(urllib.request.Request('http://localhost:8000/api/v1/chatbot/chat', data=json.dumps({'message':'Show high risk projects'}).encode(), headers={'Content-Type':'application/json'})).read().decode())"
```

---

## 📚 Technical Documentation Directory

For deep-dive architectural specifications, refer to the [`docs/`](./docs) folder:

- 📖 [System Architecture Specifications](./docs/architecture.md)
- 🗄️ [Database Schema & ERD Design](./docs/database.md)
- 🤖 [Model Card & Anomaly Scorer](./docs/model-card.md)
- 📊 [ML Methodology & Stage Intelligence](./docs/ml-methodology.md)
- 🔌 [API Reference Specifications](./docs/api.md)
- 🛡️ [Security, RBAC & Data Provenance Standard](./docs/security.md)
- 📋 [System User Guide](./docs/system-user-guide.md)

---

## 👥 Contributors & Maintainers

Maintained with ❤️ for modernized, transparent, and predictive Indian infrastructure governance.
