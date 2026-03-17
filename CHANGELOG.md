# Changelog

## 2026-02-18

- Hardened inventory/request controls and closed remaining FR gaps.
- Added governance automation for tracker, performance SLA, backup, security smoke, and audit integrity.
- Added encrypted backup artifacts, restore utility, and audit archival utility.
- Added documentation governance policy and validation evidence artifacts.

## 2026-02-19

- Added state-of-the-art foundations across platform layers:
  - Event-driven domain event stream (`domain_events`) and realtime websocket feed (`/ws/stock`, `/api/events/recent`)
  - Workflow engine starter endpoints (`/api/workflow/rules`, `/api/workflow/evaluate`)
  - Integration platform starter endpoints (`/api/integrations/finance`, `/api/integrations/finance/test`)
  - Forecasting report endpoint (`/api/reports/forecast`)
- Added request/job/stock event emission hooks for continuous automation and live updates.
- Added request correlation IDs and optional strict HTTPS enforcement toggle in backend configuration.
- Added mobile/PWA baseline (`manifest.webmanifest`, `sw.js`, service worker registration).
- Added production/security env keys for request ID and HTTPS enforcement.
- Updated API and roadmap documentation for newly added advanced features.
- Added final infra-layer scaffold:
  - Observability overlay (`docker-compose.observability.yml`) with Prometheus, Grafana, and OTel collector configs.
  - OIDC-ready SSO contract and verification utilities (`/auth/oidc/config`, `/auth/oidc/exchange`, OIDC middleware path).
  - Queue-backed outbox pattern (`outbox_events`, outbox enqueue from domain events, worker scaffold script).
  - Native Prometheus scrape endpoint (`/metrics`).
- Implemented hardening pass for production-readiness gaps:
  - Added Alembic migration lifecycle (`backend/alembic`, `docs/migrations.md`) with baseline + hardening revisions.
  - Added SRE runbook and observability alert rules (`docs/sre-runbook.md`, `deploy/observability/alerts.yml`).
  - Hardened outbox worker with lock tokens, idempotency headers, dead-letter retry endpoint, and platform ops visibility.
  - Added OIDC health endpoint and platform compliance status API.
  - Added tenant isolation primitives (tenant model, tenant-scoped session criteria, `X-Tenant-ID` guardrails).
  - Extended ERP/accounting integration contracts and webhook test routes.
  - Added backend pytest smoke tests and certification automation script.
