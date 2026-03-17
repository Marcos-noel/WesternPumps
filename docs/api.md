# API

The backend exposes a REST API via FastAPI.

- Base URL: `http://localhost:8000`
- OpenAPI/Swagger: `http://localhost:8000/docs`

## Auth

- `POST /auth/login` (form-encoded)
- `POST /auth/bootstrap` (JSON)
- `GET /auth/oidc/config` (OIDC contract settings for frontend SSO flow)
- `POST /auth/oidc/exchange` (SSO token exchange stub; currently returns `501`)
- `GET /auth/oidc/health` (OIDC discovery/JWKS readiness report)
- `GET /users/me` (requires auth)
- `GET /users` (admin only)
- `POST /users` (admin only)

## Customers

- `GET /customers`
- `POST /customers`
- `GET /customers/{customer_id}`
- `PATCH /customers/{customer_id}`
- `DELETE /customers/{customer_id}`

## Jobs

- `GET /jobs`
- `POST /jobs`
- `GET /jobs/{job_id}`
- `PATCH /jobs/{job_id}`
- `DELETE /jobs/{job_id}`

## Inventory items

- `GET /api/items` (paginated, supports search and sorting)
- `POST /api/items`
- `PUT /api/items/{item_id}`
- `GET /api/items/{item_id}/qr` (SVG QR code)
- `GET /api/items/{item_id}/instances`
- `POST /api/items/{item_id}/instances`
- `POST /api/items/{item_id}/instances/bulk`
- `GET /api/stock/low` (low-stock list)

## Suppliers

- `GET /api/suppliers`
- `POST /api/suppliers`
- `PATCH /api/suppliers/{supplier_id}`
- `DELETE /api/suppliers/{supplier_id}` (deactivates supplier)

## Stock transactions

- `GET /api/stock/transactions` (filterable by `part_id`)
- `POST /api/stock/transactions`

## Categories & locations

- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/{category_id}`
- `GET /api/locations`
- `POST /api/locations`
- `PATCH /api/locations/{location_id}`

## Stock requests

- `GET /api/requests`
- `POST /api/requests`
- `POST /api/requests/{request_id}/approve`
- `POST /api/requests/{request_id}/reject`
- `POST /api/requests/{request_id}/issue`
- `POST /api/requests/usage`

## Reports

- `GET /api/reports/stock-level?format=excel|pdf|docx`
- `GET /api/reports/stock-movement?format=excel|pdf|docx`
- `GET /api/reports/forecast?days=30&lookback_days=30`

## Workflow engine

- `GET /api/workflow/rules`
- `PUT /api/workflow/rules`
- `POST /api/workflow/evaluate`

## Realtime + events

- `GET /api/events/recent`
- `WS /ws/stock` (stock/request/job domain events + heartbeat)

## Platform + observability

- `GET /health`
- `GET /health/slo`
- `GET /metrics` (Prometheus scrape endpoint)

## Integrations

- `GET /api/integrations/finance`
- `PUT /api/integrations/finance`
- `POST /api/integrations/finance/test`
- `GET /api/integrations/erp`
- `PUT /api/integrations/erp`
- `POST /api/integrations/erp/test`
- `GET /api/integrations/accounting`
- `PUT /api/integrations/accounting`
- `POST /api/integrations/accounting/test`

## Operations

- `GET /api/operations/purchase-orders`
- `POST /api/operations/purchase-orders`
- `POST /api/operations/purchase-orders/{po_id}/status`
- `POST /api/operations/purchase-orders/{po_id}/dispatch`
- `POST /api/operations/purchase-orders/{po_id}/receipts`
- `POST /api/operations/reservations`
- `POST /api/operations/reservations/{reservation_id}/release`
- `GET /api/operations/transfers`
- `POST /api/operations/transfers`
- `POST /api/operations/transfers/{transfer_id}/approve`
- `POST /api/operations/transfers/{transfer_id}/complete`
- `GET /api/operations/cycle-counts`
- `POST /api/operations/cycle-counts`
- `POST /api/operations/cycle-counts/{cycle_id}/submit`
- `POST /api/operations/cycle-counts/{cycle_id}/approve`
- `POST /api/operations/cycle-counts/{cycle_id}/reject`
- `GET /api/operations/replenishment/suggestions`
- `GET /api/operations/kpi/summary`
- `GET /api/operations/executive/summary`

## Platform operations

- `GET /api/platform/outbox/health`
- `POST /api/platform/outbox/retry-dead`
- `GET /api/platform/compliance/status`
- `GET /api/platform/system/about`

## Patterns

- Most endpoints require a Bearer token.
- Validation errors return `400`.
- Conflicts (e.g., duplicate SKU/email) return `409`.
