import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.models.enums import CheckSlot, MealStatus, MoodValue
from app.schemas.common import ORMModel


class MealCheckIn(BaseModel):
    check_date: date
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
    check_date: date
    slot: CheckSlot
    mood: MoodValue


class MoodCheckOut(ORMModel):
    id: uuid.UUID
    check_date: date
    slot: CheckSlot
    mood: MoodValue
    checked_at: datetime
