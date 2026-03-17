# Release Governance

This project uses a lightweight release workflow to reduce regression risk and improve traceability.

## Required checks before release
1. Backend starts cleanly (`python -c "from app.main import create_app; create_app()"` from backend context).
2. Frontend production build passes (`npm --prefix frontend run build`).
3. Performance acceptance benchmark passes (`python scripts/perf_acceptance.py --url <health-url>`).
4. Security smoke checks pass (`python scripts/security_smoke.py --base-url <api-base-url>`).
5. Backup created with retention and optional encryption (`python scripts/backup_db.py ...`).
6. Restore utility confirms recoverability (`python scripts/restore_db.py ...`).
7. Audit integrity check passes for the active DB (`python scripts/verify_audit_chain.py --sqlite-path <db>` for SQLite environments).
8. Scale benchmark evidence is generated (`python scripts/scale_benchmark.py --sku-count 10000 --instance-count 100000`).
9. DB index/scaling checks pass (`python scripts/db_scaling_checks.py --sqlite-path <db>`).
10. Uptime probe confirms SLO evidence (`python scripts/uptime_probe.py --url <health-url>`).
11. Documentation governance checks pass (`python scripts/check_docs_governance.py`).
12. Requirements tracker is regenerated (`python scripts/update_requirements_tracker.py`).

## One-command governance run
Use the PowerShell helper to run tracker refresh + optional perf/backup/audit verification:

```powershell
# Tracker only (safe default)
powershell -ExecutionPolicy Bypass -File .\scripts\run_governance.ps1 -SkipPerf -SkipBackup

# Full run example for SQLite
powershell -ExecutionPolicy Bypass -File .\scripts\run_governance.ps1 `
  -ApiUrl "http://127.0.0.1:8000/health" `
  -PerfUsers 50 `
  -PerfRequestsPerUser 20 `
  -PerfMaxP95Ms 1200 `
  -BackupRetentionDays 30 `
  -SqlitePath ".\backend\westernpumps.db" `
  -RunAuditVerify `
  -RunAuditArchive
```

## Release record
For each release, capture:
- Release version/tag
- Date/time (UTC)
- Commit SHA
- Scope summary
- FR/NFR status changes
- Rollback steps

Recommended location: `CHANGELOG.md`.

## Rollback readiness
- Keep one pre-release backup.
- Keep one post-release backup.
- Document DB restore command and target file.
