import uuid

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
    font_scale: int | None = Field(default=None, description="100 · 125 · 150")
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
