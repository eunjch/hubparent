"""복약 일정 전개.

`medications` 는 규칙(시각 목록 · 요일 · 기간)만 갖는다.
"오늘 몇 시에 무엇을 먹어야 하는가"는 그 규칙을 날짜에 펼쳐서 만든다.

시각은 "HH:MM" 로 저장하고 사용자 타임존(KST) 기준으로 해석한다.
DB 에 남기는 scheduled_at 은 UTC 다 — 계획서 5.2.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.timeutil import as_utc
from app.models.care import Medication, MedicationLog
from app.models.enums import MedicationStatus

KST = ZoneInfo(settings.APP_TIMEZONE)


@dataclass(frozen=True)
class Occurrence:
    medication: Medication
    time_label: str  # "08:00"
    scheduled_at: datetime  # UTC


def _parse(label: str) -> time:
    hh, mm = label.split(":")
    return time(int(hh), int(mm))


def to_utc(day: date, label: str) -> datetime:
    """KST 의 (날짜, "HH:MM") 을 UTC 로 옮긴다."""
    return datetime.combine(day, _parse(label), tzinfo=KST).astimezone(UTC)


def today_kst() -> date:
    return datetime.now(KST).date()


async def occurrences(session: AsyncSession, user_id: uuid.UUID, day: date) -> list[Occurrence]:
    """해당 날짜에 먹어야 하는 건들. 시각 순으로 돌려준다."""
    meds = await session.scalars(
        select(Medication).where(Medication.user_id == user_id, Medication.is_active.is_(True))
    )

    found: list[Occurrence] = []
    for med in meds:
        if med.start_date > day:
            continue
        if med.end_date is not None and med.end_date < day:
            continue
        if day.weekday() not in (med.weekdays or []):
            continue
        for label in med.times or []:
            found.append(Occurrence(med, label, to_utc(day, label)))

    return sorted(found, key=lambda o: o.scheduled_at)


async def with_status(
    session: AsyncSession, user_id: uuid.UUID, day: date
) -> list[tuple[Occurrence, MedicationStatus]]:
    """오늘 복용 건 + 응답 상태. 응답이 없으면 pending 이다."""
    found = await occurrences(session, user_id, day)
    if not found:
        return []

    logs = await session.scalars(
        select(MedicationLog).where(
            MedicationLog.user_id == user_id,
            MedicationLog.medication_id.in_({o.medication.id for o in found}),
        )
    )
    # (약, 예정시각) 으로 찾는다. SQLite 는 naive 로 돌려주므로 UTC 로 맞춘 뒤 비교한다.
    answered = {(lg.medication_id, as_utc(lg.scheduled_at)): lg.status for lg in logs}

    return [(o, answered.get((o.medication.id, o.scheduled_at), MedicationStatus.PENDING)) for o in found]
