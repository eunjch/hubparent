"""토큰 세대 — 비밀번호를 바꾸면 기존 세션을 끊는다

계정을 뺏긴 사람이 비밀번호를 바꿔도 공격자의 refresh 토큰이 최대 180일 살아 있었다
(2026-09-11 재점검). 토큰에 세대를 싣고, 비밀번호 변경 때 올린다.

Revision ID: e7a2c94f1b30
Revises: d5f1a8c30b62
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e7a2c94f1b30"
down_revision: str | None = "d5f1a8c30b62"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_epoch", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "token_epoch")
