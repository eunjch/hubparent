"""widen notification_logs.dedupe_key to 200

보호자용 중복 방지 키가 80자를 넘어 INSERT 가 실패하고 워커 작업이 죽었다 (2026-09-09 운영에서 확인).

Revision ID: c3e9a7b2d4f1
Revises: b7d1e4f0c9a2
Create Date: 2026-09-09 15:40:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'c3e9a7b2d4f1'
down_revision: str | None = 'b7d1e4f0c9a2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column('notification_logs', 'dedupe_key', type_=sa.String(length=200), existing_type=sa.String(length=80))


def downgrade() -> None:
    op.alter_column('notification_logs', 'dedupe_key', type_=sa.String(length=80), existing_type=sa.String(length=200))
