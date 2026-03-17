param(
  [switch]$SkipFrontend,
  [switch]$SkipBackend,
  [switch]$CheckHealth
)

$ErrorActionPreference = "Stop"

function Step($message) {
  Write-Host "`n==> $message" -ForegroundColor Cyan
}

function Resolve-Python {
  if (Test-Path "backend/.venv/Scripts/python.exe") {
    return "backend/.venv/Scripts/python.exe"
  }
  return "python"
}

if (-not $SkipBackend) {
  Step "Backend syntax/import check (compileall)"
  $py = Resolve-Python
  & $py -m compileall backend/app
}

if (-not $SkipFrontend) {
  Step "Frontend type check (tsc --noEmit)"
  Push-Location frontend
  try {
    if (-not (Test-Path "node_modules")) {
      Write-Host "frontend/node_modules not found. Run npm install first." -ForegroundColor Yellow
    } else {
      npx tsc --noEmit
    }
  } finally {
    Pop-Location
  }
}

if ($CheckHealth) {
  Step "Backend /health check"
  try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 8
    Write-Host ("Health status: " + ($resp.status | Out-String).Trim()) -ForegroundColor Green
  } catch {
    Write-Host "Could not reach http://127.0.0.1:8000/health. Start backend first if needed." -ForegroundColor Yellow
  }
}

Step "Sanity checks complete"
