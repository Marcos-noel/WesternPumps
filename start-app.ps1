# WesternPumps Easy Start Script (SQLite Version)
# Run this script to start the entire application

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  WesternPumps Easy Start" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Setup root .env
Write-Host "[1/4] Setting up environment files..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  Created .env from .env.example" -ForegroundColor Green
} else {
    Write-Host "  .env already exists" -ForegroundColor Gray
}

# Configure for SQLite and enable auth (require login)
Write-Host "[2/4] Configuring for SQLite and enabling auth..." -ForegroundColor Yellow
$envContent = Get-Content ".env" -Raw
# Enable auth (DISABLE_AUTH=false means auth is NOT disabled = auth is enabled)
$envContent = $envContent -replace "DISABLE_AUTH=true", "DISABLE_AUTH=false"
$envContent = $envContent -replace "VITE_DISABLE_AUTH=true", "VITE_DISABLE_AUTH=false"
Set-Content -Path ".env" -Value $envContent
Write-Host "  Auth enabled - login required" -ForegroundColor Green

# Setup backend
Write-Host "[3/4] Setting up backend..." -ForegroundColor Yellow
Set-Location "backend"

# Create venv if not exists
if (-not (Test-Path ".venv")) {
    python -m venv .venv
    Write-Host "  Created Python virtual environment" -ForegroundColor Green
}

# Activate venv and install requirements
& ".venv/Scripts/Activate.ps1" | Out-Null
pip install -r requirements.txt --quiet 2>$null
Write-Host "  Python dependencies installed" -ForegroundColor Green

# Create backend .env with SQLite
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

# Update DATABASE_URL to use SQLite and enable auth
$backendEnv = Get-Content ".env" -Raw
$backendEnv = $backendEnv -replace "DATABASE_URL=mysql\+pymysql://.*", "DATABASE_URL=sqlite:///../devdata/backend/westernpumps.db"
$backendEnv = $backendEnv -replace "DISABLE_AUTH=true", "DISABLE_AUTH=false"
# Set seed admin user for automatic creation
$backendEnv = $backendEnv -replace "SEED_ADMIN_EMAIL=$", "SEED_ADMIN_EMAIL=admin@westernpumps.com"
$backendEnv = $backendEnv -replace "SEED_ADMIN_PASSWORD=$", "SEED_ADMIN_PASSWORD=admin123"
$backendEnv = $backendEnv -replace "SEED_ADMIN_FULL_NAME=$", "SEED_ADMIN_FULL_NAME=Admin User"
Set-Content -Path ".env" -Value $backendEnv
Write-Host "  Backend configured for SQLite with auth enabled" -ForegroundColor Green

Set-Location ".."

# Setup frontend
Write-Host "[4/4] Setting up frontend..." -ForegroundColor Yellow
Set-Location "frontend"

# Install npm packages
npm install --silent 2>$null
Write-Host "  NPM dependencies installed" -ForegroundColor Green

# Create frontend .env
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

# Update frontend .env - enable auth
$frontendEnv = Get-Content ".env" -Raw
$frontendEnv = $frontendEnv -replace "VITE_DISABLE_AUTH=true", "VITE_DISABLE_AUTH=false"
Set-Content -Path ".env" -Value $frontendEnv

Set-Location ".."

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Starting Services..." -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Start backend
Write-Host "Starting backend on http://localhost:8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .venv/Scripts/Activate.ps1; uvicorn app.main:app --reload --port 8000" -WindowStyle Normal

# Wait for backend to start
Start-Sleep -Seconds 3

# Start frontend
Write-Host "Starting frontend on http://localhost:5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Application Started!" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access the app at: http://localhost:5173" -ForegroundColor Green
Write-Host "API docs at: http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "LOGIN CREDENTIALS:" -ForegroundColor Yellow
Write-Host "  Email: admin@westernpumps.com" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "Database: devdata/backend/westernpumps.db" -ForegroundColor Gray
