"""baseline schema + stamp

Revision ID: 0001_baseline_stamp
Revises:
Create Date: 2026-02-19 17:10:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

from app.db import Base
from app import models  # noqa: F401 - register metadata

revision = "0001_baseline_stamp"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create the initial schema from SQLAlchemy metadata.

    Notes:
    - This intentionally uses `metadata.create_all()` to keep the baseline maintainable.
    - Later revisions must be additive and idempotent where possible.
    """
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # If core tables already exist, assume this database was bootstrapped earlier (e.g. via ensure_schema).
    if inspector.has_table("users") or inspector.has_table("parts") or inspector.has_table("jobs"):
        return

    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    pass
