"""서버 푸시 발송 — 계획서 8.5 "푸시가 주(主)".

FCM 자격증명(FCM_CREDENTIALS_PATH)이 아직 없다. 준비되면 _deliver() 만 채우면 된다.
그 전까지는 발송 이력만 남긴다 — 무엇을 언제 보내려 했는지는 지금부터 쌓여야
"안 울렸어요" 문의에 답할 수 있다 (8.5.11).
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import UserRole
from app.models.notify import NotificationLog
from app.models.user import Device, FamilyMember

log = logging.getLogger("hubfamily.push")


def configured() -> bool:
    return bool(settings.FCM_CREDENTIALS_PATH)


async def _deliver(tokens: list[str], title: str, body: str, channel: str, route: str) -> None:
    """FCM 으로 실제 발송. 자격증명이 붙는 시점에 채운다."""
    raise NotImplementedError("FCM 미설정")


async def already_sent(session: AsyncSession, dedupe_key: str) -> bool:
    row = await session.scalar(
        select(NotificationLog.id).where(NotificationLog.dedupe_key == dedupe_key).limit(1)
    )
    return row is not None


async def send(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    title: str,
    body: str,
    channel: str,
    route: str,
    dedupe_key: str | None = None,
) -> NotificationLog:
    """사용자의 모든 단말로 푸시를 보내고 이력을 남긴다.

    dedupe_key 가 있으면 같은 키로 이미 보낸 건은 다시 보내지 않는다.
    """
    if dedupe_key and await already_sent(session, dedupe_key):
        existing = await session.scalar(
            select(NotificationLog).where(NotificationLog.dedupe_key == dedupe_key).limit(1)
        )
        assert existing is not None
        return existing

    tokens = list(
        await session.scalars(
            select(Device.push_token).where(Device.user_id == user_id, Device.push_token.is_not(None))
        )
    )

    event = "skipped"
    detail: str | None = None
    if not tokens:
        detail = "등록된 단말 없음"
    elif not configured():
        detail = "FCM 미설정"
    else:
        try:
            await _deliver(tokens, title, body, channel, route)
            event = "sent"
        except Exception as exc:  # noqa: BLE001 — 발송 실패는 이력으로만 남긴다
            event = "failed"
            detail = str(exc)[:200]
            log.warning("푸시 실패 user=%s: %s", user_id, exc)

    row = NotificationLog(
        user_id=user_id,
        kind="push",
        event=event,
        channel=channel,
        title=title,
        dedupe_key=dedupe_key,
        at=datetime.now(UTC),
        detail=detail,
    )
    session.add(row)
    await session.flush()
    return row


async def guardians_of(session: AsyncSession, family_id: uuid.UUID) -> list[uuid.UUID]:
    rows = await session.scalars(
        select(FamilyMember.user_id).where(
            FamilyMember.family_id == family_id, FamilyMember.role == UserRole.GUARDIAN
        )
    )
    return list(rows)


async def send_to_guardians(
    session: AsyncSession,
    family_id: uuid.UUID,
    *,
    title: str,
    body: str,
    channel: str,
    route: str,
    dedupe_key: str | None = None,
) -> int:
    """가족의 보호자 전원에게. 이상 징후·하루 요약이 쓴다."""
    count = 0
    for gid in await guardians_of(session, family_id):
        key = f"{dedupe_key}:{gid}" if dedupe_key else None
        await send(session, gid, title=title, body=body, channel=channel, route=route, dedupe_key=key)
        count += 1
    return count
