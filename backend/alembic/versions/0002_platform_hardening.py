"""platform hardening (tenant + outbox locks)

Revision ID: 0002_platform_hardening
Revises: 0001_baseline_stamp
Create Date: 2026-02-19 17:12:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_platform_hardening"
down_revision = "0001_baseline_stamp"
branch_labels = None
depends_on = None


def _has_table(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return any(c["name"] == column_name for c in inspector.get_columns(table_name))


def _has_index(inspector, table_name: str, index_name: str) -> bool:
    return any(idx.get("name") == index_name for idx in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_table(inspector, "tenants"):
        op.create_table(
            "tenants",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("code", sa.String(length=80), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        )
        op.create_index("ix_tenants_name", "tenants", ["name"], unique=True)
        op.create_index("ix_tenants_code", "tenants", ["code"], unique=True)
        op.execute(
            sa.text(
                """
                INSERT INTO tenants (id, name, code, is_active, created_at, updated_at)
                VALUES (1, 'WesternPumps', 'default', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """
            )
        )

    tenant_tables = [
        "users",
        "customers",
        "jobs",
        "parts",
        "suppliers",
        "stock_transactions",
        "item_instances",
        "issued_batch_items",
        "stock_requests",
        "stock_request_lines",
        "usage_records",
        "batch_usage_records",
        "audit_logs",
        "app_settings",
        "product_attachments",
        "domain_events",
        "outbox_events",
    ]
    for table_name in tenant_tables:
        if not _has_table(inspector, table_name):
            continue
        if not _has_column(inspector, table_name, "tenant_id"):
            op.add_column(table_name, sa.Column("tenant_id", sa.Integer(), nullable=False, server_default=sa.text("1")))
        idx_name = f"ix_{table_name}_tenant_id"
        if not _has_index(inspector, table_name, idx_name):
            op.create_index(idx_name, table_name, ["tenant_id"])

    if _has_table(inspector, "outbox_events"):
        if not _has_column(inspector, "outbox_events", "lock_token"):
            op.add_column("outbox_events", sa.Column("lock_token", sa.String(length=120), nullable=True))
        if not _has_column(inspector, "outbox_events", "locked_at"):
            op.add_column("outbox_events", sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True))
        if not _has_index(inspector, "outbox_events", "ix_outbox_events_lock_token"):
            op.create_index("ix_outbox_events_lock_token", "outbox_events", ["lock_token"])
        if not _has_index(inspector, "outbox_events", "ix_outbox_events_locked_at"):
            op.create_index("ix_outbox_events_locked_at", "outbox_events", ["locked_at"])


def downgrade() -> None:
    # Destructive rollback intentionally omitted for safety in production data.
    pass

