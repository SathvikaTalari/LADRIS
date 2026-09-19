# =============================================================================
# LADRIS - One-Click Team Setup Script (Windows PowerShell)
# Run from the project root: .\setup_team.ps1
# =============================================================================

# Allow native commands (docker, pip, npm) to write progress to stderr without
# triggering PowerShell NativeCommandError false alarms
$ErrorActionPreference = "Continue"
if (Test-Path variable:global:PSNativeCommandUseErrorActionPreference) {
    $global:PSNativeCommandUseErrorActionPreference = $false
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   LADRIS - Automated Team Onboarding Setup" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

$RepoRoot = $PSScriptRoot
if (-not $RepoRoot) { $RepoRoot = (Get-Location).Path }

# ─── Prerequisites Check ──────────────────────────────────────────────────────
Write-Host "[0/6] Checking prerequisites..." -ForegroundColor Yellow
$missing = @()
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { $missing += "Python 3.10+" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "Node.js 18+" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { $missing += "npm" }
if ($missing.Count -gt 0) {
    Write-Host "   [ERROR] Missing required tools: $($missing -join ', ')" -ForegroundColor Red
    Write-Host "           Install them and re-run this script." -ForegroundColor Red
    exit 1
}
Write-Host "   [OK] Python, Node.js and npm found." -ForegroundColor Green

# ─── Step 1: Environment File ─────────────────────────────────────────────────
Write-Host "`n[1/6] Setting up environment file..." -ForegroundColor Yellow
if (-not (Test-Path "$RepoRoot\.env")) {
    Copy-Item "$RepoRoot\.env.example" "$RepoRoot\.env"
    Write-Host "   [OK] .env created from .env.example." -ForegroundColor Green
} else {
    Write-Host "   [OK] .env already exists." -ForegroundColor Green
}

# ─── Step 2: Start PostGIS DB Container ──────────────────────────────────────
Write-Host "`n[2/6] Starting PostGIS database container..." -ForegroundColor Yellow
$dockerAvailable = $false
try {
    $null = docker info 2>$null
    if ($LASTEXITCODE -eq 0) {
        $dockerAvailable = $true
    }
} catch {
    # docker not found
}

if (-not $dockerAvailable) {
    Write-Host "   [WARN] Docker is not running or not installed." -ForegroundColor Yellow
    Write-Host "          If you have a LOCAL PostgreSQL on port 5432, the app will try to use it." -ForegroundColor Yellow
    Write-Host "          For full PostGIS + GIS map support, install Docker Desktop and re-run." -ForegroundColor Yellow
} else {
    Set-Location $RepoRoot
    # Start container without 2>&1 pipeline redirection to prevent PowerShell NativeCommandError
    docker compose up -d db
    Write-Host "   [OK] Docker container started. Waiting for PostgreSQL to be ready..." -ForegroundColor Green

    # Wait for DB to be healthy (up to 60 seconds)
    $maxWait = 60
    $waited = 0
    $dbReady = $false
    while ($waited -lt $maxWait) {
        $status = docker inspect --format='{{.State.Health.Status}}' landpulse_db 2>$null
        if ($status -eq "healthy") {
            $dbReady = $true
            break
        }
        Start-Sleep -Seconds 3
        $waited += 3
        Write-Host "   ... waiting for database ($waited/$maxWait s)" -ForegroundColor DarkGray
    }
    if ($dbReady) {
        Write-Host "   [OK] PostgreSQL is ready on port 15432." -ForegroundColor Green
    } else {
        Write-Host "   [WARN] DB container health check timed out. Proceeding anyway..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

# ─── Step 3: Python Virtual Environment & Dependencies ───────────────────────
Write-Host "`n[3/6] Setting up Python virtual environment & dependencies..." -ForegroundColor Yellow
Set-Location "$RepoRoot\backend"
if (-not (Test-Path "venv")) {
    Write-Host "   Creating virtual environment..." -ForegroundColor DarkGray
    python -m venv venv
}
$BackendPy = "$RepoRoot\backend\venv\Scripts\python.exe"
if (-not (Test-Path $BackendPy)) {
    Write-Host "   [ERROR] Could not create venv. Ensure Python 3.10+ is installed." -ForegroundColor Red
    exit 1
}
Write-Host "   Installing Python packages (this may take 2-3 minutes on first run)..." -ForegroundColor DarkGray
& $BackendPy -m pip install --quiet --upgrade pip
& $BackendPy -m pip install --quiet -r requirements.txt
Write-Host "   [OK] Python dependencies installed." -ForegroundColor Green

# ─── Step 4: Database Migrations & Schema Sync ───────────────────────────────
Write-Host "`n[4/6] Running database migrations & schema synchronization..." -ForegroundColor Yellow
Set-Location "$RepoRoot\backend"
& $BackendPy run_migrations.py
if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Database schema & PostGIS extensions verified." -ForegroundColor Green
} else {
    Write-Host "   [ERROR] Migration failed (exit code $LASTEXITCODE)." -ForegroundColor Red
    Write-Host "           Check that your database container is running: docker compose up -d db" -ForegroundColor Yellow
    Write-Host "           Then re-run: .\setup_team.ps1" -ForegroundColor Yellow
    exit 1
}

# ─── Step 5: Load Projects & Generate ML Predictions ─────────────────────────
Write-Host "`n[5/6] Loading projects from CSV & generating ML predictions..." -ForegroundColor Yellow
Set-Location "$RepoRoot\backend"
& $BackendPy seed_my_raw_projects.py
if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Projects loaded and ML predictions generated." -ForegroundColor Green
} else {
    Write-Host "   [WARN] Project seeding had non-zero exit code: $LASTEXITCODE" -ForegroundColor Yellow
    Write-Host "          The app will still work; you can re-run seed_my_raw_projects.py later." -ForegroundColor Yellow
}

# ─── Step 6: Frontend npm Dependencies ───────────────────────────────────────
Write-Host "`n[6/6] Checking frontend npm dependencies..." -ForegroundColor Yellow
Set-Location "$RepoRoot\frontend"
if (-not (Test-Path "node_modules")) {
    Write-Host "   Installing npm packages..." -ForegroundColor DarkGray
    npm install
}
Write-Host "   [OK] Frontend is ready." -ForegroundColor Green

Set-Location $RepoRoot

# ─── Doctor Health Check ─────────────────────────────────────────────────────
Write-Host "`n[*] Running environment health check..." -ForegroundColor Cyan
Set-Location "$RepoRoot\backend"
& $BackendPy "$RepoRoot\doctor.py"

Set-Location $RepoRoot

# ─── Done ─────────────────────────────────────────────────────────────────────
Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "   [SUCCESS] LADRIS Setup Complete!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "`nTo start the application, open TWO terminal windows:" -ForegroundColor White
Write-Host ""
Write-Host "  Terminal 1 - Backend:" -ForegroundColor Yellow
Write-Host "    cd backend" -ForegroundColor Gray
Write-Host "    .\venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "    uvicorn app.main:app --reload --port 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "  Terminal 2 - Frontend:" -ForegroundColor Yellow
Write-Host "    cd frontend" -ForegroundColor Gray
Write-Host "    npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  Browser URL  : http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Demo Login   : admin@ladris.gov.in  /  Password123!" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Trouble?     : cd backend && python ..\doctor.py" -ForegroundColor DarkGray
Write-Host ""
