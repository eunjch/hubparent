"""구독 · 감사 로그."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPKMixin, enum_column
from app.models.enums import SubscriptionStatus


class Subscription(Base, UUIDPKMixin, TimestampMixin):
    """15일 무료체험 후 월 9,900원. MVP 는 체험 기간 관리까지만 한다."""

    __tablename__ = "subscriptions"

    family_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("families.id"), index=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(20), default="standard", nullable=False)
    status: Mapped[SubscriptionStatus] = enum_column(
        SubscriptionStatus, default=SubscriptionStatus.TRIAL, nullable=False
    )
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_billing_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditLog(Base, UUIDPKMixin):
    """보호자가 어르신의 민감정보를 조회한 기록.

    개인정보보호법 대응. 조회 라우터에서 남긴다 — 계획서 11장.
    """

    __tablename__ = "audit_logs"

    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    target_type: Mapped[str] = mapped_column(String(30), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(64))
    ip: Mapped[str | None] = mapped_column(String(45))
    detail: Mapped[str | None] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
