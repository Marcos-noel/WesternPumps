# SRE Runbook

## Objective

Operate WesternPumps in production with clear incident, rollback, and verification procedures.

## Live Checks

1. `GET /health` must return `{"status":"ok"}`.
2. `GET /health/slo` must keep:
   - `availability_percent >= 99.9`
   - `p95_latency_ms <= 1000`
3. `GET /metrics` must be scrapeable by Prometheus.
4. `GET /api/platform/compliance/status` must report:
   - `status = ok`
   - `outbox_dead = 0`
   - `oidc_ok = true` when OIDC is enabled.

## Alert Response

### High 5xx or low availability

1. Check backend logs (`backend/logs/backend_errors.log`).
2. Verify DB reachability and lock pressure.
3. Drain outbox backlog:
   - `GET /api/platform/outbox/health`
4. If dead letters exist:
   - `POST /api/platform/outbox/retry-dead`
5. If unresolved in 15 minutes, execute rollback.

### OIDC degraded

1. Check `GET /auth/oidc/health`.
2. Validate issuer/JWKS settings and network egress.
3. If IdP outage persists, switch to local JWT login path per incident policy.

## Rollback Discipline

Use Alembic:

```powershell
cd backend
alembic current
alembic history
alembic downgrade -1
```

For high-risk releases:

1. Snapshot DB backup first.
2. Deploy migration.
3. Run smoke tests.
4. If smoke fails, rollback migration and redeploy last stable build.

## Daily Operations

1. Run governance checks:
   - `.\scripts\run_governance.ps1 -RunPerfSmoke -RunSecuritySmoke`
2. Review:
   - Prometheus alert state
   - Outbox health endpoint
   - Audit integrity job status

