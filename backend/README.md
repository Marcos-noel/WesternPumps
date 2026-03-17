# Backend (FastAPI)

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

For test/dev tooling:

```powershell
pip install -r requirements-dev.txt
```

## Run

```powershell
uvicorn app.main:app --reload --port 8000
```

## Migrations (Alembic)

```powershell
alembic stamp 0001_baseline_stamp
alembic upgrade head
```

## Tests

```powershell
pytest -q
```
