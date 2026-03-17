Param(
  [string]$ApiBase = "http://127.0.0.1:8000",
  [switch]$SkipPytest
)

$ErrorActionPreference = "Stop"

Write-Host "== WesternPumps certification check =="

if (-not $SkipPytest) {
  Write-Host "Running backend pytest suite..."
  Push-Location backend
  try {
    python -m pytest -q
  } finally {
    Pop-Location
  }
}

Write-Host "Running performance smoke..."
python scripts/perf_smoke.py --base-url $ApiBase

Write-Host "Running security smoke..."
python scripts/security_smoke.py --base-url $ApiBase

Write-Host "Running docs governance check..."
python scripts/check_docs_governance.py

Write-Host "Certification check complete."

