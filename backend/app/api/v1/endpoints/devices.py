"""단말 등록 · 하트비트 · 생활 신호 업로드."""

from datetime import UTC, datetime

from fastapi import APIRouter, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.monitor import ActivitySignal
from app.models.user import Device
from app.schemas.common import Ok
from app.schemas.device import DeviceOut, DeviceRegister, SignalBatch
from app.services import presence

router = APIRouter(tags=["devices"])


@router.post("/devices", response_model=DeviceOut)
async def register_device(payload: DeviceRegister, user: CurrentUser, session: DBSession) -> DeviceOut:
    """같은 단말이 토큰을 갱신하는 경우가 많아 upsert 로 처리한다."""
    device = None
    if payload.push_token:
        device = await session.scalar(select(Device).where(Device.push_token == payload.push_token))
    if device is None:
        device = await session.scalar(
            select(Device).where(Device.user_id == user.id, Device.platform == payload.platform)
        )

    now = datetime.now(UTC)
    if device is None:
        device = Device(
            user_id=user.id,
            platform=payload.platform,
            push_token=payload.push_token,
            app_version=payload.app_version,
            last_seen_at=now,
        )
        session.add(device)
    else:
        device.user_id = user.id
        device.push_token = payload.push_token or device.push_token
        device.app_version = payload.app_version or device.app_version
        device.last_seen_at = now

    await session.flush()
    return DeviceOut.model_validate(device)


@router.post("/heartbeat", response_model=Ok)
async def heartbeat(user: CurrentUser, session: DBSession) -> Ok:
    """앱이 살아있음을 알린다. 안드로이드는 WorkManager 주기 작업에서 호출한다."""
    await presence.touch(session, user.id)
    return Ok()


@router.post("/signals", response_model=Ok, status_code=status.HTTP_202_ACCEPTED)
async def upload_signals(payload: SignalBatch, user: CurrentUser, session: DBSession) -> Ok:
    """30분 간격으로 모아둔 생활 신호를 6시간마다 배치로 받는다."""
    session.add_all(
        [
            ActivitySignal(
                user_id=user.id,
                recorded_at=s.recorded_at,
                screen_on_count=s.screen_on_count,
                step_count=s.step_count,
                light_level=s.light_level,
                battery=s.battery,
                is_charging=s.is_charging,
            )
            for s in payload.signals
        ]
    )
    await presence.touch(session, user.id)
    return Ok()
