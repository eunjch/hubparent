import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import DevicePlatform
from app.schemas.common import ORMModel


class DeviceRegister(BaseModel):
    platform: DevicePlatform
    push_token: str | None = Field(default=None, max_length=255)
    app_version: str | None = Field(default=None, max_length=20)
    # 알림 권한을 허락했는가. 거부해도 이 값을 남기려고 토큰 없이도 등록을 받는다
    notifications_granted: bool | None = None


class DeviceOut(ORMModel):
    id: uuid.UUID
    platform: DevicePlatform
    last_seen_at: datetime


class SignalIn(BaseModel):
    """30분 간격으로 단말에 쌓아 두고 6시간마다 배치로 올린다."""

    recorded_at: datetime
    # 상한이 없어 음수 걸음 수나 int 범위를 넘는 값이 들어가던 것을 막는다 (2026-09-11 점검).
    # PostgreSQL 의 integer 는 21억이 상한이라 넘기면 500 이 난다.
    screen_on_count: int = Field(default=0, ge=0, le=100_000)
    step_count: int = Field(default=0, ge=0, le=200_000)
    light_level: int | None = Field(default=None, ge=0, le=100_000)
    battery: int | None = Field(default=None, ge=0, le=100)
    is_charging: bool | None = None


class SignalBatch(BaseModel):
    signals: list[SignalIn] = Field(max_length=500)
