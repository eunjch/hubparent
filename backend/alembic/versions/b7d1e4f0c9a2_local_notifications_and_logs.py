"""local notifications and notification logs

Revision ID: b7d1e4f0c9a2
Revises: ad2cb81fc302
Create Date: 2026-09-08 18:40:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'b7d1e4f0c9a2'
down_revision: str | None = 'ad2cb81fc302'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'local_notifications',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('source_id', sa.Uuid(), nullable=False),
        sa.Column('fire_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('title', sa.String(length=100), nullable=False),
        sa.Column('body', sa.String(length=200), nullable=False),
        sa.Column('channel', sa.String(length=20), nullable=False),
        sa.Column('route', sa.String(length=100), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_local_notifications_fire_at'), 'local_notifications', ['fire_at'])
    op.create_index(op.f('ix_local_notifications_source_id'), 'local_notifications', ['source_id'])
    op.create_index(op.f('ix_local_notifications_user_id'), 'local_notifications', ['user_id'])

    op.create_table(
        'notification_logs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('event', sa.String(length=20), nullable=False),
        sa.Column('channel', sa.String(length=20), nullable=True),
        sa.Column('title', sa.String(length=100), nullable=True),
        sa.Column('local_id', sa.Integer(), nullable=True),
        sa.Column('dedupe_key', sa.String(length=80), nullable=True),
        sa.Column('at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('detail', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notification_logs_at'), 'notification_logs', ['at'])
    op.create_index(op.f('ix_notification_logs_dedupe_key'), 'notification_logs', ['dedupe_key'])
    op.create_index(op.f('ix_notification_logs_user_id'), 'notification_logs', ['user_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_notification_logs_user_id'), table_name='notification_logs')
    op.drop_index(op.f('ix_notification_logs_dedupe_key'), table_name='notification_logs')
    op.drop_index(op.f('ix_notification_logs_at'), table_name='notification_logs')
    op.drop_table('notification_logs')
    op.drop_index(op.f('ix_local_notifications_user_id'), table_name='local_notifications')
    op.drop_index(op.f('ix_local_notifications_source_id'), table_name='local_notifications')
    op.drop_index(op.f('ix_local_notifications_fire_at'), table_name='local_notifications')
    op.drop_table('local_notifications')
