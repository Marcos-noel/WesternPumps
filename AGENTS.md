# AGENTS.md
This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands (PowerShell)
### Docker quickstart
- Create env file: `Copy-Item .env.example .env`
- Start full stack: `docker compose up --build`
- Reset Docker data: `docker compose down -v`

### Backend (FastAPI)
- Setup (from `backend/`):
  - `python -m venv .venv`
  - `.\\.venv\\Scripts\\Activate.ps1`
  - `pip install -r requirements.txt`
  - `Copy-Item .env.example .env`
- Run API (from `backend/`): `uvicorn app.main:app --reload --port 8000`
- Reset a user password (dev):  
  `backend\\.venv\\Scripts\\python.exe -B backend\\scripts\\reset_user_password.py --email you@example.com --password "NewPassword123"`

### Frontend (React + Vite)
- Setup (from `frontend/`):
  - `npm install`
  - `Copy-Item .env.example .env`
- Run dev server (from `frontend/`): `npm run dev`
- Build (from `frontend/`): `npm run build`

### Tests / lint
- Backend tests: from `backend/`, run `pip install -r requirements-dev.txt` then `pytest -q`
- No dedicated lint command is currently documented.

## High-level architecture
### System shape
- Three services: `frontend` (React), `backend` (FastAPI), `db` (MySQL in Docker). SQLite is supported for local dev via `DATABASE_URL`. See `docs/architecture.md`.
- Authentication is JWT-based; UI stores `access_token` in `localStorage` and sends `Authorization: Bearer <token>`.
- Dev auth can be disabled via envs:
  - Backend: `DISABLE_AUTH` (default `false` in current `.env.example`) auto-creates `dev@example.com` admin when enabled.
  - Frontend: `VITE_DISABLE_AUTH` (default `false` in current `.env.example`) bypasses login UI when enabled.

### Backend layout (FastAPI)
- App entry: `backend/app/main.py` creates the FastAPI app, sets CORS, and wires routers.
- Routers: `backend/app/routers/*.py` (auth, users, customers, jobs, parts/items, stock, requests, reports, etc.).
- Data layer:
  - SQLAlchemy models in `backend/app/models.py`.
  - Pydantic schemas in `backend/app/schemas.py`.
  - DB engine/session in `backend/app/db.py` (no Alembic; `ensure_schema()` patches additive changes).
- Auth/roles dependencies in `backend/app/deps.py` (admin and role checks).
- Settings in `backend/app/config.py` load `.env` from repo root or `backend/`.

### Frontend layout (React + Vite)
- Entry: `frontend/src/main.tsx` wires router, theme, and `AuthProvider`.
- Routes/shell: `frontend/src/App.tsx` defines protected routes and role-gated pages.
- API client: `frontend/src/api/client.ts` configures Axios, base URL (`VITE_API_BASE_URL`), and auth headers.
- Domain API wrappers in `frontend/src/api/*`, page screens in `frontend/src/pages/*`, shared UI in `frontend/src/components/*`.

### Domain modules (big picture)
- Core entities: customers, jobs, inventory items/parts, suppliers, stock transactions, stock requests.
- Inventory is audit-friendly: on-hand quantity + stock transaction ledger (IN/OUT/ADJUST). See `docs/architecture.md` and `docs/inventory.md`.
- Docs index: `docs/README.md` links to `overview.md`, `architecture.md`, `auth.md`, `api.md`, and module docs.
