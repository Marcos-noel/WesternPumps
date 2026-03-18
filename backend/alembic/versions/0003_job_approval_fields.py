"""Add job approval workflow fields

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add approval workflow columns to jobs table
    op.add_column('jobs', sa.Column('approved_by_user_id', sa.Integer(), nullable=True))
    op.add_column('jobs', sa.Column('approved_at', sa.DateTime(), nullable=True))
    op.add_column('jobs', sa.Column('approval_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'approval_notes')
    op.drop_column('jobs', 'approved_at')
    op.drop_column('jobs', 'approved_by_user_id')
