# Roadmap

This is a pragmatic roadmap inspired by best-in-class inventory systems (e.g., ledger-based stock movements, supplier management, replenishment workflows).

## Inventory

- Stock movement workflow in UI (Receive / Issue / Adjust) + transaction history
- Supplier management UI
- Replenishment suggestions (“Need to reorder” based on min quantity)
- CSV import/export
- Item locations (warehouse/bin), multi-location stock (future)

## Jobs

- Job detail view
- Assignments and status updates from the UI
- Linking parts to jobs (consumed inventory)

## Customers

- Customer detail view with job history
- Notes and address editing in UI

## Admin

- User management screen (admin only)
- Role-based UI gating and audit trails

## Next-gen foundations (implemented baseline)

- Event-driven foundation:
  - Domain event persistence (`domain_events`) and realtime stock/job/request stream (`WS /ws/stock`)
- Workflow engine starter:
  - Rules storage and transition evaluation endpoints (`/api/workflow/*`)
- Integration platform starter:
  - Finance integration settings and signed webhook test endpoint (`/api/integrations/finance*`)
- Forecasting starter:
  - Rolling-average stock forecast endpoint (`/api/reports/forecast`)
- Mobile/PWA readiness:
  - Web app manifest + service worker registration for installable/mobile-friendly behavior
- Observability/security hardening:
  - Request correlation IDs and optional strict HTTPS enforcement toggle
