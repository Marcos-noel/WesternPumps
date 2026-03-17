"""baseline stamp

Revision ID: 0001_baseline_stamp
Revises:
Create Date: 2026-02-19 17:10:00
"""
from __future__ import annotations


revision = "0001_baseline_stamp"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing installations should stamp this baseline before applying newer revisions.
    pass


def downgrade() -> None:
    pass

