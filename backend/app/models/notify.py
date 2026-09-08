"""알림 — 로컬 예약 계획 · 발송 이력 (계획서 8.5)."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPKMixin


class LocalNotification(Base, TimestampMixin):
    """단말이 예약할 로컬 알림 한 건. id 가 곧 Capacitor 의 알림 ID 다.

    Capacitor 로컬 알림 ID 는 32비트 int 여야 한다 (계획서 8.5.5).
    그래서 UUID 가 아니라 자동 증가 정수를 쓴다.
    일정·복약이 바뀌어 더 이상 울리면 안 되는 건은 지우지 않고 revoked 로 둔다 —
    단말이 그 ID 를 받아 취소해야 하기 때문이다.
    """

    __tablename__ = "local_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)     # medication · schedule
    source_id: Mapped[uuid.UUID] = mapped_column(index=True, nullable=False)
    fire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    body: Mapped[str] = mapped_column(String(200), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)    # 8.5.7 채널 ID
    route: Mapped[str] = mapped_column(String(100), nullable=False)     # 8.5.9
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class NotificationLog(Base, UUIDPKMixin):
    """"안 울렸어요" 문의에 답하기 위한 이력. 보관 90일 (계획서 8.5.11).

    kind=push  는 서버가 보낸 것, kind=local 은 단말이 보고한 것이다.
    dedupe_key 는 서버 발송분의 중복 방지용이다 (예: "schedule:{id}:60").
    """

    __tablename__ = "notification_logs"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)       # push · local
    event: Mapped[str] = mapped_column(String(20), nullable=False)      # sent · skipped · failed · scheduled · fired · canceled
    channel: Mapped[str | None] = mapped_column(String(20))
    title: Mapped[str | None] = mapped_column(String(100))
    local_id: Mapped[int | None] = mapped_column(Integer)
    dedupe_key: Mapped[str | None] = mapped_column(String(80), index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
