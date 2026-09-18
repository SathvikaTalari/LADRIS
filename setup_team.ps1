# =============================================================================
# LADRIS - One-Click Team Setup Script (Windows PowerShell)
# =============================================================================
Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "   LADRIS - Automated Team Onboarding Setup" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

$RepoRoot = $PSScriptRoot
Set-Location $RepoRoot

# 1. Environment file setup
if (-not (Test-Path "$RepoRoot\.env")) {
    Write-Host "[1/5] Creating root .env from .env.example..." -ForegroundColor Yellow
    Copy-Item "$RepoRoot\.env.example" "$RepoRoot\.env"
    Write-Host "   [OK] .env created." -ForegroundColor Green
} else {
    Write-Host "[1/5] Root .env already exists." -ForegroundColor Green
}

# 2. Database container check
Write-Host "`n[2/5] Starting PostGIS database container (landpulse_db)..." -ForegroundColor Yellow
try {
    docker compose up -d db
    Write-Host "   [OK] Database container is running on port 15432." -ForegroundColor Green
} catch {
    Write-Host "   [WARN] Docker command failed or Docker is not running. If you have local Postgres on 5432, that will be used." -ForegroundColor Yellow
}

# 3. Backend virtual environment & dependencies
Write-Host "`n[3/6] Setting up Backend Python virtual environment..." -ForegroundColor Yellow
Set-Location "$RepoRoot\backend"
if (-not (Test-Path "venv")) {
    python -m venv venv
}
$BackendPy = "$RepoRoot\backend\venv\Scripts\python.exe"
& $BackendPy -m pip install --quiet --upgrade pip
& $BackendPy -m pip install --quiet -r requirements.txt
Write-Host "   [OK] Backend dependencies installed." -ForegroundColor Green

# 4. Apply all database migrations & verify PostGIS
Write-Host "`n[4/6] Running database migrations & schema synchronization..." -ForegroundColor Yellow
& $BackendPy run_migrations.py
Write-Host "   [OK] Database schema & PostGIS extensions verified." -ForegroundColor Green

# 5. Sync my_raw_projects.csv and generate ML delay predictions
Write-Host "`n[5/6] Loading projects from my_raw_projects.csv and generating ML predictions..." -ForegroundColor Yellow
& $BackendPy seed_my_raw_projects.py
Write-Host "   [OK] ML predictions and SHAP explanations synchronized." -ForegroundColor Green

# 6. Frontend dependencies
Write-Host "`n[6/6] Checking Frontend npm dependencies..." -ForegroundColor Yellow
Set-Location "$RepoRoot\frontend"
if (-not (Test-Path "node_modules")) {
    npm install
}
Write-Host "   [OK] Frontend ready." -ForegroundColor Green

Set-Location $RepoRoot

# Run environment doctor check
& $BackendPy "$RepoRoot\doctor.py"

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "   [SUCCESS] LADRIS Environment Setup Complete!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "`nTo start the application:" -ForegroundColor White
Write-Host "  Terminal 1 (Backend):" -ForegroundColor Yellow
Write-Host "    cd backend" -ForegroundColor Gray
Write-Host "    .\venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "    uvicorn app.main:app --reload --port 8000`n" -ForegroundColor Gray
Write-Host "  Terminal 2 (Frontend):" -ForegroundColor Yellow
Write-Host "    cd frontend" -ForegroundColor Gray
Write-Host "    npm run dev`n" -ForegroundColor Gray
Write-Host "Open your browser at: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Login credentials: select any role from the dropdown (e.g. Super Admin or District Officer)!`n" -ForegroundColor White
