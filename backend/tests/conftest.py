from __future__ import annotations

import os


# Tests should run in a self-contained dev-bypass mode.
# - Avoids needing to mint tokens for every request.
# - Uses an isolated in-memory SQLite database.
os.environ.setdefault("DISABLE_AUTH", "true")
os.environ.setdefault("AUTO_CREATE_TABLES", "true")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "dev-test-secret-please-change-32chars-minimum")

