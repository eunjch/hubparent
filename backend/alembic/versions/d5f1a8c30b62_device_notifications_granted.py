"""단말의 알림 권한 상태

부모님이 알림을 거부하면 복약 알림이 아예 안 울리는데 자녀가 알 방법이 없었다
(계획서 8.5.8 · 2026-09-11 점검). 단말이 올려 주고 두 화면이 배너로 보여 준다.

Revision ID: d5f1a8c30b62
Revises: c3e9a7b2d4f1
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d5f1a8c30b62"
down_revision: str | None = "c3e9a7b2d4f1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 옛 버전 앱이 올린 행은 알 수 없으므로 NULL 로 둔다 (모른다 ≠ 거부했다)
    op.add_column("devices", sa.Column("notifications_granted", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("devices", "notifications_granted")
