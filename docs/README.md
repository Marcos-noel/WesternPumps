# WesternPumps Documentation

This folder documents the product, data model, and developer workflows for the WesternPumps system.

## Index

- `docs/overview.md` — product overview and scope
- `docs/architecture.md` — high-level architecture and key flows
- `docs/auth.md` — authentication, roles, and permissions
- `docs/customers.md` — customer management
- `docs/jobs.md` — service jobs
- `docs/inventory.md` — inventory (items, suppliers, stock movements)
- `docs/api.md` — API surface (routes, payloads, patterns)
- `docs/ui-ux.md` — UI/UX guidelines (layout, tables, forms, states)
- `docs/roadmap.md` — feature roadmap and next iterations

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
