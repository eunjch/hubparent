"""로컬 알림 예약 계획 — 계획서 8.5.4 · 8.5.5.

단말은 "앞으로 며칠치를 언제 울려야 하는가"만 알면 된다.
서버가 복약·일정 규칙을 펼쳐 알림 한 건마다 int ID 를 발급하고, 규칙이 바뀌어
사라진 건은 revoked 로 표시해 단말이 취소하게 한다.

iOS 는 앱당 64개가 한계라 MAX_ITEMS 로 자른다. 가까운 것부터 준다.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.timeutil import as_utc
from app.models.care import Schedule
from app.models.notify import LocalNotification, NotificationLog
from app.services import medication as med_service

MAX_ITEMS = 60
DEFAULT_DAYS = 14

REMINDER_TITLE = {
    0: "지금 일정 시간이에요",
    10: "10분 후 일정이 있어요",
    30: "30분 후 일정이 있어요",
    60: "1시간 후 일정이 있어요",
    120: "2시간 후 일정이 있어요",
    1440: "내일 일정이 있어요",
}


@dataclass(frozen=True)
class Planned:
    source: str
    source_id: uuid.UUID
    fire_at: datetime
    title: str
    body: str
    channel: str
    route: str


def schedule_body(row: Schedule) -> str:
    return f"{row.place} / {row.title}" if row.place else row.title


async def desired(session: AsyncSession, user_id: uuid.UUID, days: int) -> list[Planned]:
    """지금부터 days 일 안에 울려야 하는 알림 전부."""
    now = datetime.now(UTC)
    horizon = now + timedelta(days=days)
    found: list[Planned] = []

    # 복약 — 날짜마다 규칙을 펼친다
    day = med_service.today_kst()
    for _ in range(days + 1):
        for occ in await med_service.occurrences(session, user_id, day):
            if now <= occ.scheduled_at <= horizon:
                med = occ.medication
                body = f"{med.name} {med.dose}" if med.dose else med.name
                found.append(
                    Planned(
                        source="medication",
                        source_id=med.id,
                        fire_at=occ.scheduled_at,
                        title="약 드실 시간이에요",
                        body=body,
                        channel="medication",
                        route="/s/med",
                    )
                )
        day += timedelta(days=1)

    # 일정 — 사전 알림마다 한 건
    schedules = await session.scalars(
        select(Schedule).where(
            Schedule.target_user_id == user_id,
            Schedule.start_at >= now - timedelta(days=1),
            Schedule.start_at <= horizon + timedelta(days=1),
        )
    )
    for sch in schedules:
        start = as_utc(sch.start_at)
        for minutes in sch.reminder_minutes or []:
            fire_at = start - timedelta(minutes=minutes)
            if now <= fire_at <= horizon:
                found.append(
                    Planned(
                        source="schedule",
                        source_id=sch.id,
                        fire_at=fire_at,
                        title=REMINDER_TITLE.get(minutes, "일정이 있어요"),
                        body=schedule_body(sch),
                        channel="schedule",
                        route="/s/schedule",
                    )
                )

    return sorted(found, key=lambda p: p.fire_at)


async def device_has_alarm(
    session: AsyncSession, user_id: uuid.UUID, source: str, source_id: uuid.UUID, fire_at: datetime
) -> bool:
    """단말이 이 건의 로컬 알람을 걸어 뒀다고 보고했는가.

    걸려 있으면 정각 푸시는 보내지 않는다 — 같은 약이 두 번 울리던 것을 막는다.
    단말의 마지막 보고가 scheduled 이면 걸려 있는 것이고, canceled 가 뒤에 오면 없는 것이다.
    보고가 아예 없으면(앱을 안 열었다) 없는 것으로 보고 푸시를 보낸다.
    """
    row = await session.scalar(
        select(LocalNotification).where(
            LocalNotification.user_id == user_id,
            LocalNotification.source == source,
            LocalNotification.source_id == source_id,
            LocalNotification.fire_at == fire_at,
            LocalNotification.revoked.is_(False),
        )
    )
    if row is None:
        return False
    last = await session.scalar(
        select(NotificationLog.event)
        .where(
            NotificationLog.kind == "local",
            NotificationLog.local_id == row.id,
            NotificationLog.event.in_(["scheduled", "canceled"]),
        )
        .order_by(NotificationLog.at.desc())
        .limit(1)
    )
    return last == "scheduled"


async def sync(
    session: AsyncSession, user_id: uuid.UUID, days: int = DEFAULT_DAYS
) -> tuple[list[LocalNotification], list[int]]:
    """바라는 목록과 발급된 목록을 맞춘다.

    돌려주는 것: (예약할 건들, 취소할 ID 들)
    """
    now = datetime.now(UTC)
    wanted = await desired(session, user_id, days)

    rows = list(
        await session.scalars(
            select(LocalNotification).where(
                LocalNotification.user_id == user_id,
                LocalNotification.fire_at >= now - timedelta(minutes=5),
            )
        )
    )
    by_key = {(r.source, r.source_id, as_utc(r.fire_at)): r for r in rows}
    wanted_keys = {(p.source, p.source_id, p.fire_at) for p in wanted}

    # 규칙에서 빠진 건 → 취소
    for key, row in by_key.items():
        if key not in wanted_keys and not row.revoked:
            row.revoked = True

    # 새로 생긴 건 → 발급. 내용이 바뀐 건은 문구만 갱신한다 (ID 유지)
    active: list[LocalNotification] = []
    for p in wanted:
        row = by_key.get((p.source, p.source_id, p.fire_at))
        if row is None:
            row = LocalNotification(
                user_id=user_id,
                source=p.source,
                source_id=p.source_id,
                fire_at=p.fire_at,
                title=p.title,
                body=p.body,
                channel=p.channel,
                route=p.route,
            )
            session.add(row)
        else:
            row.title, row.body, row.route, row.revoked = p.title, p.body, p.route, False
        active.append(row)

    await session.flush()

    active.sort(key=lambda r: as_utc(r.fire_at))
    revoked_ids = sorted(r.id for r in rows if r.revoked)
    return active[:MAX_ITEMS], revoked_ids
