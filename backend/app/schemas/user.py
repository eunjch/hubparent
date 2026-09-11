import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ContactIn(BaseModel):
    name: str = Field(max_length=50)
    phone: str = Field(max_length=20)
    relation: str | None = Field(default=None, max_length=20)
    sort_order: int = 0


class ContactOut(ORMModel):
    id: uuid.UUID
    name: str
    phone: str
    relation: str | None
    sort_order: int


class SettingsIn(BaseModel):
    # 값 자체를 셋으로 묶는다. 범위가 없어 99999999999 나 음수가 들어가던 것을 막는다
    font_scale: Literal[100, 125, 150] | None = None
    voice_guide: bool | None = None
    notify_meal: bool | None = None
    notify_medication: bool | None = None
    notify_schedule: bool | None = None


class SettingsOut(ORMModel):
    font_scale: int
    voice_guide: bool
    notify_meal: bool
    notify_medication: bool
    notify_schedule: bool
