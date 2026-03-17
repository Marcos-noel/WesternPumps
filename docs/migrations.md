# Migration & Versioning Strategy

## Tooling

- Alembic is the source of truth for schema versioning.
- Location: `backend/alembic/`
- Current baseline: `0001_baseline_stamp`
- Hardening revision: `0002_platform_hardening`

## First-time Adoption on Existing DB

If your database was created before Alembic:

```powershell
cd backend
alembic stamp 0001_baseline_stamp
alembic upgrade head
```

## Normal Release Flow

1. Create revision:

```powershell
cd backend
alembic revision -m "short_change_name"
```

2. Implement `upgrade()` and safe `downgrade()` path.
3. Validate locally:

```powershell
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

4. Deploy with:

```powershell
alembic upgrade head
```

## Rollback Discipline

- Always take DB backup before upgrade.
- If release fails:
  - `alembic downgrade -1`
  - redeploy previous app artifact
- Record incident + root cause in release notes.

## Rules

- Never edit old migration files after release.
- Each migration must be idempotent across SQLite/MySQL where possible.
- Use additive migrations first; destructive changes require a two-phase rollout.

