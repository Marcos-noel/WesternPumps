# WesternPumps Easy Start Script
# Fixed version with correct settings

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  WesternPumps Easy Start" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check database
Write-Host "[INFO] Database: backend/devdata/westernpumps.db" -ForegroundColor Gray

# Setup backend
Write-Host "[1/3] Setting up backend..." -ForegroundColor Yellow
Set-Location "backend"

# Create venv if not exists
if (-not (Test-Path ".venv")) {
    python -m venv .venv
    Write-Host "  Created Python venv" -ForegroundColor Green
}

# Install requirements
& ".venv/Scripts/Activate.ps1" -ErrorAction SilentlyContinue | Out-Null
pip install -r requirements.txt --quiet 2>$null

# Ensure .env has correct settings
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
$envContent = Get-Content ".env" -Raw
$envContent = $envContent -replace "JWT_SECRET=.*", "JWT_SECRET=dev-secret-key-for-local-testing-123456789"
$envContent = $envContent -replace "DATABASE_URL=sqlite:///devdata/westernpumps.db", "DATABASE_URL=sqlite:///devdata/westernpumps.db"
Set-Content -Path ".env" -Value $envContent

Write-Host "  Backend ready" -ForegroundColor Green
Set-Location ".."

# Setup frontend
Write-Host "[2/3] Setting up frontend..." -ForegroundColor Yellow
Set-Location "frontend"

npm install --quiet 2>$null

# Ensure .env has correct settings
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }

Write-Host "  Frontend ready" -ForegroundColor Green
Set-Location ".."

# Start services
Write-Host "[3/3] Starting services..." -ForegroundColor Yellow
Write-Host ""

# Start backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .venv/Scripts/Activate.ps1; uvicorn app.main:app --reload --port 8000" -WindowStyle Normal
Write-Host "  Backend: http://localhost:8000" -ForegroundColor Green

Start-Sleep -Seconds 2

# Start frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  APP STARTED!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Open in browser: http://localhost:5173" -ForegroundColor White
