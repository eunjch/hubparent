import uuid
from datetime import date, datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from pydantic import AfterValidator, BaseModel

from app.models.enums import CheckSlot, MealStatus, MoodValue
from app.schemas.common import ORMModel

KST = ZoneInfo("Asia/Seoul")


def _not_future(v: date) -> date:
    """내일 이후 날짜는 받지 않는다. 시차를 감안해 하루는 열어 둔다.

    상한이 없어 2099년 기록이 들어가던 것을 막는다 (2026-09-11 점검).
    """
    if v > datetime.now(KST).date() + timedelta(days=1):
        raise ValueError("아직 오지 않은 날짜입니다.")
    return v


CheckDate = Annotated[date, AfterValidator(_not_future)]


class MealCheckIn(BaseModel):
    check_date: CheckDate
    slot: CheckSlot
    status: MealStatus


class MealCheckOut(ORMModel):
    id: uuid.UUID
    check_date: date
    slot: CheckSlot
    status: MealStatus
    photo_path: str | None
    checked_at: datetime


class MoodCheckIn(BaseModel):
    check_date: CheckDate
    slot: CheckSlot
    mood: MoodValue


class MoodCheckOut(ORMModel):
    id: uuid.UUID
    check_date: date
    slot: CheckSlot
    mood: MoodValue
    checked_at: datetime
