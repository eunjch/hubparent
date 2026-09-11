"""단말 등록 · 하트비트 · 생활 신호 업로드."""

from datetime import UTC, datetime

from fastapi import APIRouter, status
from sqlalchemy import select, update

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
        # 소유자까지 함께 본다. 토큰만으로 찾으면 남의 단말 행을 자기 것으로 바꿔
        # 그 사람의 복약 알림을 끊을 수 있다 (2026-09-11 점검).
        device = await session.scalar(
            select(Device).where(
                Device.push_token == payload.push_token, Device.user_id == user.id
            )
        )
        if device is None:
            # 같은 토큰을 남이 쥐고 있다. push_token 에 유니크 제약이 있으므로 놓아 줘야
            # 내 행에 붙일 수 있다. 한 기기를 물려주거나 가족이 함께 쓰는 흔한 경우다.
            # 행을 지우지는 않는다 — last_seen_at 은 그 사람의 생존 신호라 남겨야 하고,
            # 지우면 "토큰을 아는 사람이 남의 기록을 없애는" 수단이 된다 (2026-09-11 재점검).
            # 이 토큰으로 계속 보내면 엉뚱한 사람 폰에 남의 건강정보가 뜨므로 놓아 주는 것이 맞다.
            await session.execute(
                update(Device)
                .where(Device.push_token == payload.push_token, Device.user_id != user.id)
                .values(push_token=None)
            )
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
            notifications_granted=payload.notifications_granted,
            last_seen_at=now,
        )
        session.add(device)
    else:
        device.push_token = payload.push_token or device.push_token
        device.app_version = payload.app_version or device.app_version
        if payload.notifications_granted is not None:
            device.notifications_granted = payload.notifications_granted
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
