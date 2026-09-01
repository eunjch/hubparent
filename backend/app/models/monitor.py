"""생활 신호 · 일일 리포트 · 이상 징후."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPKMixin
from app.models.enums import ActivityLevel, AlertSeverity, AlertType, MoodValue


class ActivitySignal(Base, TimestampMixin):
    """스마트폰 생활 신호. 30분 간격 로컬 적재 → 6시간마다 배치 업로드.

    증가 속도가 가장 빠른 테이블이다. 90일 보관 후 일 단위 집계로 롤업하고
    원본은 삭제한다 — 계획서 5.2 · 11장 파기 정책.
    """

    __tablename__ = "activity_signals"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    screen_on_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    step_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    light_level: Mapped[int | None] = mapped_column(Integer)      # lux
    battery: Mapped[int | None] = mapped_column(SmallInteger)     # 0–100
    is_charging: Mapped[bool | None] = mapped_column(Boolean)


class DailyReport(Base, UUIDPKMixin, TimestampMixin):
    """매일 21:00 KST 생성. 화면 6(어르신) · 화면 7(자녀)이 같은 행을 읽는다."""

    __tablename__ = "daily_reports"
    __table_args__ = (UniqueConstraint("user_id", "report_date", name="uq_daily_report"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    report_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    meal_done: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)   # 0–3
    med_taken: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    med_total: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    mood: Mapped[MoodValue | None] = mapped_column(String(10))    # 당일 최빈값
    activity_level: Mapped[ActivityLevel | None] = mapped_column(String(10))
    summary_text: Mapped[str | None] = mapped_column(Text)


class Alert(Base, UUIDPKMixin, TimestampMixin):
    """화면 8. 동일 유형은 ack 전까지 재생성하지 않는다 — 계획서 8.2."""

    __tablename__ = "alerts"

    family_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("families.id"), index=True, nullable=False)
    target_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    type: Mapped[AlertType] = mapped_column(String(20), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(String(10), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    ack_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    ack_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
