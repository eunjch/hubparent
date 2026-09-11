import uuid
from datetime import date, datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from pydantic import AfterValidator, BaseModel

from app.models.enums import CheckSlot, MealStatus, MoodValue
from app.schemas.common import ORMModel

KST = ZoneInfo("Asia/Seoul")


def _in_range(v: date) -> date:
    """너무 먼 과거·미래를 받지 않는다.

    상한이 없어 2099년 기록이 들어가던 것을 막고(2026-09-11 점검),
    하한이 없어 1900년도 들어가던 것도 막는다(재점검). 시차를 감안해 앞뒤로 하루씩 연다.
    지난 기록을 채워 넣는 것은 정상이므로 과거는 1년까지 받는다.
    """
    today = datetime.now(KST).date()
    if v > today + timedelta(days=1):
        raise ValueError("아직 오지 않은 날짜입니다.")
    if v < today - timedelta(days=365):
        raise ValueError("너무 오래된 날짜입니다.")
    return v


CheckDate = Annotated[date, AfterValidator(_in_range)]


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
