"""체크 3종 · 복약 · 일정."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPKMixin, enum_column
from app.models.enums import CheckSlot, MealStatus, MedicationStatus, MoodValue, ScheduleKind


class MealCheck(Base, UUIDPKMixin, TimestampMixin):
    """화면 2. (user, date, slot) 유니크 — 중복 입력 방지 및 멱등 처리."""

    __tablename__ = "meal_checks"
    __table_args__ = (UniqueConstraint("user_id", "check_date", "slot", name="uq_meal_check"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    check_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    slot: Mapped[CheckSlot] = enum_column(CheckSlot, nullable=False)
    status: Mapped[MealStatus] = enum_column(MealStatus, nullable=False)
    photo_path: Mapped[str | None] = mapped_column(String(255))  # 선택 항목
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class MoodCheck(Base, UUIDPKMixin, TimestampMixin):
    """화면 4."""

    __tablename__ = "mood_checks"
    __table_args__ = (UniqueConstraint("user_id", "check_date", "slot", name="uq_mood_check"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    check_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    slot: Mapped[CheckSlot] = enum_column(CheckSlot, nullable=False)
    mood: Mapped[MoodValue] = enum_column(MoodValue, nullable=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Medication(Base, UUIDPKMixin, TimestampMixin):
    """복약 스케줄. times 는 사용자 타임존(KST) 기준 시각이다."""

    __tablename__ = "medications"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    dose: Mapped[str | None] = mapped_column(String(40))          # "1알", "2정" 등
    # "HH:MM" 문자열 목록. PostgreSQL 전용 ARRAY 대신 JSON 을 써서
    # 테스트를 SQLite 로 돌릴 수 있게 한다.
    times: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    weekdays: Mapped[list[int]] = mapped_column(JSON, nullable=False)  # 0=월 … 6=일
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class MedicationLog(Base, UUIDPKMixin, TimestampMixin):
    """예정 시각 1건 = 로그 1행. reminder_level 이 에스컬레이션 단계다 — 계획서 8.1.

    L0 예정 시각 / L1 +30분 / L2 +2시간 / L3 당일 마감
    """

    __tablename__ = "medication_logs"
    __table_args__ = (UniqueConstraint("medication_id", "scheduled_at", name="uq_medication_log"),)

    medication_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("medications.id"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    status: Mapped[MedicationStatus] = enum_column(
        MedicationStatus, default=MedicationStatus.PENDING, nullable=False
    )
    reminder_level: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Schedule(Base, UUIDPKMixin, TimestampMixin):
    """화면 5. 자녀가 병원 일정을 등록하면 어르신에게 알림이 간다."""

    __tablename__ = "schedules"

    family_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("families.id"), index=True, nullable=False)
    target_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    kind: Mapped[ScheduleKind] = enum_column(ScheduleKind, nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    place: Mapped[str | None] = mapped_column(String(100))
    notify_before_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
