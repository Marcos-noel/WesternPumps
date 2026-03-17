param(
  [string]$ApiBase = "http://127.0.0.1:8000",
  [string]$Email = "",
  [string]$Password = "",
  [int]$RequestId = 0
)

$ErrorActionPreference = "Stop"

function Step($message) {
  Write-Host "`n==> $message" -ForegroundColor Cyan
}

function Ok($message) {
  Write-Host "PASS: $message" -ForegroundColor Green
}

function Warn($message) {
  Write-Host "WARN: $message" -ForegroundColor Yellow
}

function Fail($message) {
  Write-Host "FAIL: $message" -ForegroundColor Red
}

Step "Health check"
try {
  $health = Invoke-RestMethod -Uri "$ApiBase/health" -Method Get -TimeoutSec 10
  if ($health.status -eq "ok") { Ok "/health is ok" } else { Warn "/health returned unexpected payload" }
} catch {
  Fail "Cannot reach $ApiBase/health. Start backend first."
  exit 1
}

if ([string]::IsNullOrWhiteSpace($Email) -or [string]::IsNullOrWhiteSpace($Password)) {
  Warn "Email/password not provided. Skipping authenticated smoke checks."
  exit 0
}

Step "Login"
$token = $null
try {
  $body = "username=$([uri]::EscapeDataString($Email))&password=$([uri]::EscapeDataString($Password))"
  $login = Invoke-RestMethod -Uri "$ApiBase/auth/login" -Method Post -ContentType "application/x-www-form-urlencoded" -Body $body -TimeoutSec 15
  $token = $login.access_token
  if ([string]::IsNullOrWhiteSpace($token)) { throw "No access_token in response" }
  Ok "Login succeeded"
} catch {
  Fail "Login failed for $Email"
  throw
}

$headers = @{ Authorization = "Bearer $token" }

Step "Core authenticated endpoints"
$checks = @(
  @{ Name = "/users/me"; Url = "$ApiBase/users/me" },
  @{ Name = "/api/requests"; Url = "$ApiBase/api/requests" },
  @{ Name = "/jobs"; Url = "$ApiBase/jobs" },
  @{ Name = "/api/items"; Url = "$ApiBase/api/items?page=1&page_size=10" },
  @{ Name = "/api/reports/audit-trail"; Url = "$ApiBase/api/reports/audit-trail?limit=10" },
  @{ Name = "/api/assistant/analyze"; Url = "$ApiBase/api/assistant/analyze"; Method = "POST"; Body = @{ question = "Scan everything in the system"; mode = "auto"; history = @() } }
)

foreach ($c in $checks) {
  try {
    if ($c.Method -eq "POST") {
      $null = Invoke-RestMethod -Uri $c.Url -Method Post -Headers $headers -ContentType "application/json" -Body ($c.Body | ConvertTo-Json -Depth 5) -TimeoutSec 20
    } else {
      $null = Invoke-RestMethod -Uri $c.Url -Method Get -Headers $headers -TimeoutSec 20
    }
    Ok $c.Name
  } catch {
    Warn "$($c.Name) check failed: $($_.Exception.Message)"
  }
}

if ($RequestId -gt 0) {
  Step "Optional request workflow probe for request id $RequestId"
  try {
    $null = Invoke-RestMethod -Uri "$ApiBase/api/requests/$RequestId/approve" -Method Post -Headers $headers -ContentType "application/json" -Body "{}" -TimeoutSec 20
    Ok "approve request $RequestId"
  } catch {
    Warn "approve request failed: $($_.Exception.Message)"
  }
  try {
    $null = Invoke-RestMethod -Uri "$ApiBase/api/requests/$RequestId/issue" -Method Post -Headers $headers -ContentType "application/json" -Body "{}" -TimeoutSec 20
    Ok "issue request $RequestId"
  } catch {
    Warn "issue request failed: $($_.Exception.Message)"
  }
  Warn "Return step is data-specific (requires issued serial/batch payload). Execute from Requests UI or dedicated return payload."
}

Step "Smoke test finished"
