# WesternPumps Documentation

This folder documents product scope, architecture, and developer workflows for WesternPumps.

## Index

- `docs/overview.md` - product overview and scope
- `docs/architecture.md` - high-level architecture and key flows
- `docs/auth.md` - authentication, roles, and permissions
- `docs/customers.md` - customer management
- `docs/jobs.md` - service jobs
- `docs/inventory.md` - inventory (items, suppliers, stock movements)
- `docs/api.md` - API surface (routes, payloads, patterns)
- `docs/ui-ux.md` - UI/UX guidelines (layout, tables, forms, states)
- `docs/roadmap.md` - feature roadmap and next iterations
- `docs/documentation-governance.md` - documentation update and validation rules
- `docs/validation/usability-validation.md` - usability evidence report
- `docs/validation/responsive-validation.md` - responsive evidence report
- `docs/db-scaling-strategy.md` - database scaling approach and benchmark evidence workflow
- `docs/production-deployment-private-access.md` - production setup for private, company-only online access across networks
- `docs/migrations.md` - Alembic migration/versioning lifecycle and rollback discipline
- `docs/sre-runbook.md` - live operations and incident response runbook

## Recent Additions

- Technician issued-items APIs and usage/return workflows with scan/GPS support.
- Audit trail export report (`/api/reports/audit-trail`) with filters.
- Admin settings API/UI for approval thresholds and reporting defaults.
- Label PDF exports and product attachment upload/download endpoints.

## Quickstart

### Docker

```powershell
Copy-Item .env.example .env
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend API docs (OpenAPI): `http://localhost:8000/docs`

### First-time login

Use **Bootstrap Admin** once in the UI to create the first admin user (only works when no active admin exists yet).

## Sanity checks

From repo root:

```powershell
.\scripts\sanity-check.ps1 -CheckHealth
```

Live smoke tests:

```powershell
.\scripts\live-smoke-test.ps1 -ApiBase "http://127.0.0.1:8000" -Email "admin@company.com" -Password "********"
```

Observability overlay (optional):

```powershell
docker compose -f docker-compose.yml -f docker-compose.observability.yml up --build
```

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

Outbox worker (optional, for async integration processing):

```powershell
cd backend
python scripts/outbox_worker.py
```

Certification check:

```powershell
.\scripts\certification-check.ps1 -ApiBase "http://127.0.0.1:8000"
```
