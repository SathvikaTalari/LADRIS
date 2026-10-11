# 🛣️ LADRIS — Land Acquisition Decision & Risk Intelligence System

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20PostGIS-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10--3.12-3776AB?style=flat-square&logo=python)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## 📖 What is LADRIS?

**LADRIS** is an AI-powered platform that helps government officers and infrastructure agencies **predict and prevent delays** in land acquisition for Indian highway and infrastructure projects.

In India, large infrastructure projects often get stuck for years because of:
- Missed legal notification deadlines (e.g., Section 3D lapsing)
- Slow compensation payments to landowners
- Court disputes and Right-of-Way blockages

LADRIS solves this by **continuously monitoring** project milestones, legal statuses, and gazette notifications — and **alerting teams before a delay happens**, not after.

> Think of it as an early-warning system for land acquisition, powered by AI.

---

## ✨ Key Features

| Feature | What it does |
|---|---|
| 🤖 **Saarthi AI Copilot** | Built-in AI assistant. Ask it questions in plain English or by voice — it queries the live database and explains legal statuses. |
| 📊 **Command Dashboard** | One-screen overview of all projects: how many are delayed, high-risk, or need urgent action. |
| 🎯 **Priority Intelligence** | Automatically ranks which projects need attention first, and explains *why*. |
| 🏛️ **LA Officer Workbench** | Workspace for Land Acquisition Officers to track hearings, notifications, and compensation. |
| 🚜 **Agency Portal** | For NHAI/state agencies to track handovers and physical possession of land. |
| 🧪 **What-If Simulator** | Lets planners test scenarios: *"If we fast-track compensation, by how many months does the project finish early?"* |
| 🗺️ **GIS Risk Map** | Interactive map showing all highway corridors color-coded by risk level (Critical → Low). |
| 📈 **District Analytics** | Charts and summaries grouped by district and state. |
| 🚨 **Early-Warning Alerts** | Automatic alerts when a legal deadline is about to lapse (e.g., the 1-year Section 3D window). |
| 🔗 **Data Source Monitor** | Tracks the health of data feeds from BhoomiRashi, Data.gov.in, and e-Courts. |

---

## 🏗️ Project Structure

```
LADRIS/
├── frontend/          ← Web UI (React 19, TypeScript, Vite)
│   └── src/
│       ├── api/       ← API client (auto-refreshes JWT tokens)
│       ├── components/← Reusable UI components
│       ├── pages/     ← Full pages (Dashboard, GIS Map, Workbench…)
│       └── store/     ← App-wide state (auth, theme)
│
├── backend/           ← REST API server (Python FastAPI)
│   └── app/
│       ├── api/v1/    ← API endpoints (projects, alerts, chatbot…)
│       ├── models/    ← Database table definitions
│       ├── services/  ← Business logic (AI chatbot, risk scoring…)
│       └── etl/       ← Data scraper and normalizer
│
├── database/          ← PostgreSQL + PostGIS migrations (SQL files)
├── land-delay-predictor/ ← Trained ML model for delay prediction
├── docs/              ← In-depth technical documentation
├── doctor.py          ← Automated health-check tool
├── docker-compose.yml ← Starts the database with one command
├── setup_team.ps1     ← One-click setup for Windows
└── setup_team.sh      ← One-click setup for Linux/macOS
```

---

## ⚙️ Prerequisites

Before you begin, make sure these are installed:

| Tool | Version | Download |
|---|---|---|
| **Docker Desktop** | Latest | https://www.docker.com/products/docker-desktop/ |
| **Python** | 3.10, 3.11, or 3.12 *(NOT 3.13)* | https://www.python.org/downloads/ |
| **Node.js** | 18 or higher | https://nodejs.org/ |

> ⚠️ **Python 3.13 is not supported yet** — some ML libraries haven't caught up.

---

## 🚀 Getting Started

You have two options: **automatic** (recommended) or **manual step-by-step**.

---

### ✅ Option 1 — Automatic Setup (Recommended)

One command does everything: creates config files, starts the database, installs packages, runs migrations, and loads demo data.

**Windows (PowerShell):**
```powershell
.\setup_team.ps1
```

**Linux / macOS (Terminal):**
```bash
chmod +x ./setup_team.sh && ./setup_team.sh
```

After setup, skip to [Starting the App](#-starting-the-app-after-setup).

---

### 🛠️ Option 2 — Manual Step-by-Step

Follow these steps in order if the automatic script fails or you prefer manual control.

#### Step 1 — Clone the repository

```bash
git clone https://github.com/SathvikaTalari/LADRIS.git
cd LADRIS
```

#### Step 2 — Create your config file

```bash
# Windows PowerShell:
Copy-Item .env.example .env

# Linux / macOS:
cp .env.example .env
```

> The `.env.example` already has all the correct default values for local development. You don't need to edit anything.

#### Step 3 — Start the database

```bash
docker compose up -d db
```

This starts PostgreSQL with the PostGIS extension on **port 15432**. Wait about 20 seconds, then verify it's running:

```bash
docker ps
# You should see: landpulse_db ... (healthy)
```

#### Step 4 — Set up and start the Backend

Open a terminal in the `backend/` folder:

```bash
cd backend

# Create a Python virtual environment:
# Windows:
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux / macOS:
python3 -m venv venv
source venv/bin/activate

# Install Python packages:
pip install -r requirements.txt

# Create database tables and load demo users:
python run_migrations.py

# Load the 25 demo projects and run ML predictions:
python seed_my_raw_projects.py

# Start the backend server:
uvicorn app.main:app --reload --port 8000
```

**The backend is now running at:** `http://localhost:8000`
**Interactive API docs:** `http://localhost:8000/docs`

#### Step 5 — Set up and start the Frontend

Open a **new terminal** in the `frontend/` folder:

```bash
cd frontend
npm install
npm run dev
```

**The web app is now running at:** `http://localhost:5173`

---

## 🌐 Starting the App (After Setup)

Once everything is set up, you only need two commands each time:

**Terminal 1 — Backend:**
```bash
# Windows:
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

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

Then open your browser: **http://localhost:5173**

---

## 🔑 Demo Login Credentials

The platform comes with pre-loaded users for every stakeholder role. On the login page, use the **"Select User Role"** dropdown to auto-fill the email and password.

| Role | Email | Password |
|---|---|---|
| **Super Admin** | `admin@ladris.gov.in` | `Password123!` |
| Central Ministry (MoRTH) | `central@ladris.gov.in` | `Password123!` |
| State Government | `state@ladris.gov.in` | `Password123!` |
| District Administration | `district@ladris.gov.in` | `Password123!` |
| Land Acquiring Officer (CALA) | `authority@ladris.gov.in` | `Password123!` |
| Project Implementing Agency | `agency@ladris.gov.in` | `Password123!` |
| Policy Maker | `policy@ladris.gov.in` | `Password123!` |

> 💡 Tip: Go to `http://localhost:5173/login`, pick a role from the dropdown, and the credentials fill in automatically.

---

## 🤖 Saarthi — The AI Assistant

**Saarthi** is the floating chat button at the bottom-right of every page.

**What you can ask it:**
- *"Which projects have the highest delay risk?"*
- *"Tell me about the Sangareddy Bypass project"*
- *"What does Section 3D mean?"*
- *"How is compensation calculated under RFCTLARR 2013?"*

**What makes it useful:**
- 🗄️ **Queries live data** — answers are pulled from the real database, not pre-written
- ⚖️ **Knows Indian land law** — explains NH Act 1956 and RFCTLARR 2013 in plain language
- 🔗 **Navigation links** — replies include buttons like `[Open GIS Map]` that take you directly to the relevant page
- 🎙️ **Voice support** — use the microphone to ask questions, and toggle the speaker to hear answers read aloud

---

## ⚖️ Indian Land Acquisition Law — Quick Reference

LADRIS tracks the following statutory stages defined under Indian law:

### National Highways Act, 1956 — Acquisition Stages

```
Section 3A  →  Intention to Acquire (published in gazette)
     ↓            ↳ Landowners have 21 days to file objections
Section 3C  →  CALA hears and decides on objections
     ↓
Section 3D  →  Declaration of Acquisition (land officially vests in Government)
     ↓            ⚠️ MUST be published within 1 year of 3A, or 3A lapses and
     ↓               the process must restart from scratch!
Section 3G  →  Compensation determined by CALA
     ↓            ↳ If disputed → goes to Arbitration by Divisional Commissioner
Section 3H  →  Compensation deposited with CALA
     ↓
Section 3E  →  Physical possession of land enforced (60-day notice required)
```

### RFCTLARR Act, 2013 — Compensation Rules

| Component | Rule |
|---|---|
| **Market Value** | Higher of: circle rate OR average of top 50% sale deeds over past 3 years |
| **Solatium** | Mandatory **+100%** added on top of market value |
| **Rural Multiplier** | **1.0x to 2.0x** based on distance from urban area |
| **Interest** | **12% per annum** from gazette notification date to award date |

---

## 🩺 Troubleshooting

If something isn't working, run the automated diagnostics tool:

```bash
# From the backend/ folder, with the virtual environment active:
python ../doctor.py
```

To attempt automatic fixes:
```bash
python ../doctor.py --fix
```

This checks 30+ things including: database connection, ML model files, Python packages, PostGIS extension, and demo user accounts.

**Common problems and quick fixes:**

| Problem | Fix |
|---|---|
| `Cannot connect to PostgreSQL` | Run `docker compose up -d db` and wait 30 seconds |
| `relation "users" does not exist` | Run `python run_migrations.py` inside `backend/` |
| `Invalid email or password` on login | Run `python run_migrations.py`, then restart the backend |
| `ML model not found` | Check `land-delay-predictor/models/` folder exists; contact repo owner if empty |
| `uvicorn: command not found` | Your virtual environment isn't activated — run the activate command first |
| Frontend shows blank page | Confirm backend is running at `http://localhost:8000/health` |

For the full troubleshooting guide with detailed solutions, see [TEAM_SETUP.md](./TEAM_SETUP.md).

---

## 🧪 Running Tests

**Backend tests:**
```bash
cd backend
# (activate venv first)
pytest
```

**Frontend type check:**
```bash
cd frontend
npx tsc --noEmit
```

---

## 📁 Important Files at a Glance

| File | What it does |
|---|---|
| `.env.example` | Config template with all default values |
| `.env` | Your actual config — **never commit this file** |
| `backend/run_migrations.py` | Creates DB tables, extensions, and demo users |
| `backend/seed_my_raw_projects.py` | Loads demo projects and ML predictions |
| `doctor.py` | 30+ health checks for diagnosing issues |
| `setup_team.ps1` | Windows one-click full setup |
| `setup_team.sh` | Linux/macOS one-click full setup |
| `docker-compose.yml` | Starts the PostgreSQL + PostGIS database |
| `land-delay-predictor/models/` | Trained LightGBM model files |

---

## 👥 Contributing & Maintainers

Built with ❤️ to modernize and bring transparency to Indian infrastructure governance.

Maintained by the LADRIS team. For issues or contributions, open a GitHub issue or pull request.
