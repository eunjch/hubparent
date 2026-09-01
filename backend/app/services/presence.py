"""생존 신호 갱신.

앱 실행 / 체크 입력 / heartbeat 중 무엇이든 이 함수를 거친다.
devices.last_seen_at 이 이상 징후 감지의 유일한 기준이다 — 계획서 8.2.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Device


async def touch(session: AsyncSession, user_id: uuid.UUID) -> None:
    await session.execute(
        update(Device).where(Device.user_id == user_id).values(last_seen_at=datetime.now(UTC))
    )
