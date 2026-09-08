"""복약 — 자녀가 등록하고 어르신이 응답한다 (계획서 7.1 G4 · 7.2 S3)."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import MedicationStatus
from app.schemas.common import ORMModel

# 0=월 … 6=일
ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]


class MedicationBase(BaseModel):
    name: str = Field(min_length=1, max_length=60, examples=["혈압약"])
    dose: str | None = Field(default=None, max_length=40, examples=["1정"])
    times: list[str] = Field(min_length=1, max_length=6, examples=[["08:00", "20:00"]])
    weekdays: list[int] = Field(default_factory=lambda: list(ALL_WEEKDAYS))
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("times")
    @classmethod
    def _check_times(cls, v: list[str]) -> list[str]:
        """"HH:MM" 만 받는다. 표시·알림 계산이 전부 이 형식을 전제한다."""
        for t in v:
            parts = t.split(":")
            if len(parts) != 2 or not all(p.isdigit() for p in parts):
                raise ValueError(f"시각 형식이 잘못되었습니다: {t}")
            hh, mm = int(parts[0]), int(parts[1])
            if not (0 <= hh <= 23 and 0 <= mm <= 59):
                raise ValueError(f"시각 범위를 벗어났습니다: {t}")
        return sorted({f"{int(t.split(':')[0]):02d}:{int(t.split(':')[1]):02d}" for t in v})

    @field_validator("weekdays")
    @classmethod
    def _check_weekdays(cls, v: list[int]) -> list[int]:
        if not v:
            raise ValueError("요일을 하나 이상 선택해 주세요.")
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("요일 값이 잘못되었습니다.")
        return sorted(set(v))


class MedicationCreate(MedicationBase):
    """자녀가 부모님 약을 등록한다."""

    user_id: uuid.UUID


class MedicationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    dose: str | None = Field(default=None, max_length=40)
    times: list[str] | None = None
    weekdays: list[int] | None = None
    end_date: date | None = None
    is_active: bool | None = None

    _check_times = field_validator("times")(MedicationBase._check_times.__func__)
    _check_weekdays = field_validator("weekdays")(MedicationBase._check_weekdays.__func__)


class MedicationOut(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    dose: str | None
    times: list[str]
    weekdays: list[int]
    start_date: date
    end_date: date | None
    is_active: bool


class DoseOut(BaseModel):
    """오늘 복용할 한 건. 어르신 화면(S3)이 이걸 그대로 그린다."""

    medication_id: uuid.UUID
    name: str
    dose: str | None
    # "08:00" — 화면에 그대로 쓴다
    time: str
    # 서버 계산용. 응답을 올릴 때 그대로 돌려보낸다
    scheduled_at: datetime
    status: MedicationStatus


class DoseAnswer(BaseModel):
    """어르신의 응답. 복용함 / 안 먹었어요."""

    scheduled_at: datetime
    status: MedicationStatus

    @field_validator("status")
    @classmethod
    def _only_answers(cls, v: MedicationStatus) -> MedicationStatus:
        if v not in (MedicationStatus.TAKEN, MedicationStatus.MISSED):
            raise ValueError("복용함 또는 안 먹었어요만 보낼 수 있습니다.")
        return v
