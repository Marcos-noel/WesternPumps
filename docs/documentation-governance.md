# Documentation Governance

## Required documents

- `docs/overview.md`
- `docs/architecture.md`
- `docs/auth.md`
- `docs/api.md`
- `docs/inventory.md`
- `docs/release-governance.md`
- `docs/requirements-status-tracker.md`
- `docs/validation/usability-validation.md`
- `docs/validation/responsive-validation.md`
- `CHANGELOG.md`

## Rules

1. Any feature changing behavior must update at least one functional document.
2. Any governance/security/release change must update `docs/release-governance.md`.
3. Each release must add a `CHANGELOG.md` entry with date, scope, and verification commands.
4. Validation evidence files must contain a current `Status` and `Test date`.

## Verification

- Run `python scripts/check_docs_governance.py`.
