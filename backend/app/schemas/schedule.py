"""일정 — 자녀가 등록하고 어르신은 확인만 한다 (계획서 7.1 G3 · 7.2 S5)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import ScheduleKind

# 사전 알림 선택지 (분). 계획서 8.5.6
#   0=정각 · 10분 · 30분 · 1시간 · 2시간 · 하루 전
REMINDER_CHOICES = [0, 10, 30, 60, 120, 1440]


class ScheduleBase(BaseModel):
    title: str = Field(min_length=1, max_length=100, examples=["서울○○병원 / 내과"])
    kind: ScheduleKind = ScheduleKind.HOSPITAL
    start_at: datetime
    place: str | None = Field(default=None, max_length=100)
    reminder_minutes: list[int] = Field(default_factory=lambda: [60])

    @field_validator("reminder_minutes")
    @classmethod
    def _check_reminders(cls, v: list[int]) -> list[int]:
        for m in v:
            if m not in REMINDER_CHOICES:
                raise ValueError(f"알림 시각을 선택지에서 골라 주세요: {m}")
        # 먼 것부터. 하루 전 → 1시간 전 순으로 울린다
        return sorted(set(v), reverse=True)


class ScheduleCreate(ScheduleBase):
    """자녀가 부모님 일정을 등록한다."""

    target_user_id: uuid.UUID


class ScheduleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    kind: ScheduleKind | None = None
    start_at: datetime | None = None
    place: str | None = Field(default=None, max_length=100)
    reminder_minutes: list[int] | None = None

    _check_reminders = field_validator("reminder_minutes")(
        ScheduleBase._check_reminders.__func__
    )


class ScheduleOut(BaseModel):
    id: uuid.UUID
    target_user_id: uuid.UUID
    title: str
    kind: ScheduleKind
    start_at: datetime
    place: str | None
    reminder_minutes: list[int]
    notified_at: datetime | None
    # 화면에서 "다가오는 일정" 배지를 붙일지 판단한다
    upcoming: bool
