# Architecture

## Tech stack

- Frontend: React + TypeScript + Vite
- Backend: FastAPI + SQLAlchemy
- Database: MySQL in Docker (SQLite supported for local dev via `DATABASE_URL`)

## High-level flow

1. User logs in (email + password)
2. Backend returns a JWT access token
3. Frontend stores the token in `localStorage` and sends it via `Authorization: Bearer <token>`
4. Protected routes in the UI require authentication

## Services

- `frontend`: UI and user workflows
- `backend`: REST API, auth, database access
- `db`: MySQL (Docker)

## Infra extensions

- Observability overlay via `docker-compose.observability.yml`:
  - Prometheus for backend metrics.
  - Grafana dashboard host.
  - OpenTelemetry Collector for OTLP ingestion/export.
- OIDC-ready auth contract:
  - Config-driven OIDC verification path in auth dependency layer.
  - `/auth/oidc/config` and `/auth/oidc/exchange` contract endpoints for SSO rollout.
- Queue-backed outbox scaffold:
  - Domain events persisted to `domain_events`.
  - Delivery events persisted to `outbox_events`.
  - Worker script (`backend/scripts/outbox_worker.py`) claims + processes outbox batches.

## Hardening foundations

- Migration lifecycle with Alembic (`backend/alembic`, `docs/migrations.md`).
- Request-scoped tenant isolation primitives:
  - tenant-aware data model columns
  - session-level tenant criteria and auto-assignment
  - optional tenant override via `X-Tenant-ID` (admin only)
- Operational compliance endpoints (`/api/platform/*`) for OIDC/outbox/security posture checks.

## Inventory model philosophy

Inventory systems become unreliable when “quantity on hand” is edited directly without a record of *why* it changed.

This project uses:

- A current on-hand quantity stored on the item for fast reads
- A stock transaction log to explain and audit changes (IN/OUT/ADJUST)

## Data model (simplified)

- `users` — system users, roles
- `customers` — customer directory
- `jobs` — service jobs linked to customers
- `parts` — inventory items (SKU, price, on-hand, reorder point)
- `suppliers` — vendor directory
- `stock_transactions` — stock movement ledger
