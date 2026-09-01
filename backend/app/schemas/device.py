import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import DevicePlatform
from app.schemas.common import ORMModel


class DeviceRegister(BaseModel):
    platform: DevicePlatform
    push_token: str | None = Field(default=None, max_length=255)
    app_version: str | None = Field(default=None, max_length=20)


class DeviceOut(ORMModel):
    id: uuid.UUID
    platform: DevicePlatform
    last_seen_at: datetime


class SignalIn(BaseModel):
    """30분 간격으로 단말에 쌓아 두고 6시간마다 배치로 올린다."""

    recorded_at: datetime
    screen_on_count: int = 0
    step_count: int = 0
    light_level: int | None = None
    battery: int | None = Field(default=None, ge=0, le=100)
    is_charging: bool | None = None


class SignalBatch(BaseModel):
    signals: list[SignalIn] = Field(max_length=500)
