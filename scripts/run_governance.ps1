param(
  [switch]$SkipTracker,
  [switch]$SkipPerf,
  [switch]$SkipBackup,
  [switch]$SkipSecuritySmoke,
  [switch]$SkipDocsGovernance,
  [switch]$SkipScaleBenchmark,
  [switch]$SkipDbScalingChecks,
  [switch]$SkipUptimeProbe,
  [switch]$RunAuditVerify,
  [switch]$RunAuditArchive,
  [string]$ApiUrl = "http://127.0.0.1:8000/health",
  [int]$PerfUsers = 50,
  [int]$PerfRequestsPerUser = 20,
  [double]$PerfTimeout = 5,
  [double]$PerfMaxP95Ms = 1000,
  [int]$PerfMaxFailedWorkers = 0,
  [string]$DatabaseUrl = "",
  [string]$SqlitePath = "",
  [string]$BackupOut = "backups",
  [int]$BackupRetentionDays = 30,
  [string]$BackupEncryptionPassphrase = "",
  [int]$ScaleSkuCount = 10000,
  [int]$ScaleInstanceCount = 100000,
  [double]$ScaleMaxQueryP95Ms = 250,
  [int]$UptimeProbeDurationSeconds = 30,
  [double]$UptimeProbeIntervalSeconds = 1,
  [double]$UptimeMinAvailabilityPercent = 99.0,
  [int]$AuditLimit = 200000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )
  Write-Host ""
  Write-Host "==> $Name"
  & $Action
}

function Run-Python {
  param(
    [Parameter(Mandatory = $true)][string[]]$Args
  )
  & python @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: python $($Args -join ' ')"
  }
}

$runDatabaseUrl = if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { $env:DATABASE_URL } else { $DatabaseUrl }

if (-not $SkipTracker) {
  Invoke-Step -Name "Update requirements tracker" -Action {
    Run-Python @("scripts/update_requirements_tracker.py")
  }
}

if (-not $SkipPerf) {
  Invoke-Step -Name "Run performance smoke" -Action {
    Run-Python @(
      "scripts/perf_smoke.py",
      "--url", $ApiUrl,
      "--users", "$PerfUsers",
      "--requests-per-user", "$PerfRequestsPerUser",
      "--timeout", "$PerfTimeout",
      "--max-p95-ms", "$PerfMaxP95Ms",
      "--max-failed-workers", "$PerfMaxFailedWorkers",
      "--min-completed", "$($PerfUsers * $PerfRequestsPerUser)"
    )
  }
}

if (-not $SkipBackup) {
  Invoke-Step -Name "Run database backup" -Action {
    $backupArgs = @("scripts/backup_db.py", "--out", $BackupOut, "--retention-days", "$BackupRetentionDays")
    if (-not [string]::IsNullOrWhiteSpace($BackupEncryptionPassphrase)) {
      $backupArgs += @("--encrypt-passphrase", $BackupEncryptionPassphrase)
    }
    if (-not [string]::IsNullOrWhiteSpace($SqlitePath)) {
      $backupArgs += @("--sqlite-path", $SqlitePath)
      Run-Python $backupArgs
      return
    }
    if ([string]::IsNullOrWhiteSpace($runDatabaseUrl)) {
      throw "Backup requires --SqlitePath or --DatabaseUrl (or env:DATABASE_URL)."
    }
    $backupArgs += @("--database-url", $runDatabaseUrl)
    Run-Python $backupArgs
  }
}

if (-not $SkipScaleBenchmark) {
  Invoke-Step -Name "Run scale benchmark" -Action {
    Run-Python @(
      "scripts/scale_benchmark.py",
      "--sku-count", "$ScaleSkuCount",
      "--instance-count", "$ScaleInstanceCount",
      "--max-query-p95-ms", "$ScaleMaxQueryP95Ms"
    )
  }
}

if (-not $SkipDbScalingChecks) {
  Invoke-Step -Name "Run DB scaling checks" -Action {
    if ([string]::IsNullOrWhiteSpace($SqlitePath)) {
      throw "DB scaling checks currently require --SqlitePath."
    }
    Run-Python @("scripts/db_scaling_checks.py", "--sqlite-path", $SqlitePath)
  }
}

if ($RunAuditVerify) {
  Invoke-Step -Name "Verify audit hash chain" -Action {
    if (-not [string]::IsNullOrWhiteSpace($SqlitePath)) {
      Run-Python @("scripts/verify_audit_chain.py", "--sqlite-path", $SqlitePath, "--limit", "$AuditLimit")
      return
    }
    if ($runDatabaseUrl -like "sqlite*") {
      $sqliteRelative = $runDatabaseUrl -replace "^sqlite:///", ""
      $sqliteAbsolute = (Resolve-Path $sqliteRelative).Path
      Run-Python @("scripts/verify_audit_chain.py", "--sqlite-path", $sqliteAbsolute, "--limit", "$AuditLimit")
      return
    }
    throw "Audit verify currently supports SQLite path. Use --SqlitePath."
  }
}

if (-not $SkipUptimeProbe) {
  Invoke-Step -Name "Run uptime probe" -Action {
    Run-Python @(
      "scripts/uptime_probe.py",
      "--url", $ApiUrl,
      "--duration-seconds", "$UptimeProbeDurationSeconds",
      "--interval-seconds", "$UptimeProbeIntervalSeconds",
      "--min-availability-percent", "$UptimeMinAvailabilityPercent"
    )
  }
}

if ($RunAuditArchive) {
  Invoke-Step -Name "Archive old audit logs" -Action {
    if ([string]::IsNullOrWhiteSpace($SqlitePath)) {
      throw "Audit archive currently supports SQLite path. Use --SqlitePath."
    }
    Run-Python @("scripts/archive_audit_logs.py", "--sqlite-path", $SqlitePath, "--out", "audit_archives")
  }
}

if (-not $SkipSecuritySmoke) {
  Invoke-Step -Name "Run security smoke" -Action {
    $baseUrl = $ApiUrl -replace "/health$", ""
    Run-Python @("scripts/security_smoke.py", "--base-url", $baseUrl)
  }
}

if (-not $SkipDocsGovernance) {
  Invoke-Step -Name "Check docs governance" -Action {
    Run-Python @("scripts/check_docs_governance.py")
  }
}

Write-Host ""
Write-Host "Governance run completed."
