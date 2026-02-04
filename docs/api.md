# API

The backend exposes a REST API via FastAPI.

- Base URL: `http://localhost:8000`
- OpenAPI/Swagger: `http://localhost:8000/docs`

## Auth

- `POST /auth/login` (form-encoded)
- `POST /auth/bootstrap` (JSON)
- `GET /users/me` (requires auth)
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
- `GET /api/stock/low` (low-stock list)

## Suppliers

- `GET /api/suppliers`
- `POST /api/suppliers`
- `PATCH /api/suppliers/{supplier_id}`
- `DELETE /api/suppliers/{supplier_id}` (deactivates supplier)

## Stock transactions

- `GET /api/stock/transactions` (filterable by `part_id`)
- `POST /api/stock/transactions`

## Patterns

- Most endpoints require a Bearer token.
- Validation errors return `400`.
- Conflicts (e.g., duplicate SKU/email) return `409`.
