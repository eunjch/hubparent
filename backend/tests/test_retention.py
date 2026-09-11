"""보관 기간 파기 — 방침에 공개한 90일을 실제로 지키는지."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models.monitor import ActivitySignal
from app.models.notify import NotificationLog
from app.services import retention
from tests.test_medications import _family


async def _count(session, model) -> int:
    return await session.scalar(select(func.count()).select_from(model))


@pytest.mark.asyncio
async def test_purge_drops_records_older_than_90_days(client, session):
    """90일 지난 것만 지우고 그 안쪽은 남긴다."""
    _gt, _st, senior_id = await _family(client)
    import uuid as _uuid

    uid = _uuid.UUID(senior_id)
    now = datetime.now(UTC)

    session.add_all(
        [
            ActivitySignal(user_id=uid, recorded_at=now - timedelta(days=120), step_count=100),
            ActivitySignal(user_id=uid, recorded_at=now - timedelta(days=91), step_count=200),
            ActivitySignal(user_id=uid, recorded_at=now - timedelta(days=30), step_count=300),
            NotificationLog(
                user_id=uid, kind="push", event="sent", channel="medication",
                title="오래된 것", at=now - timedelta(days=100),
            ),
            NotificationLog(
                user_id=uid, kind="push", event="sent", channel="medication",
                title="최근 것", at=now - timedelta(days=10),
            ),
        ]
    )
    await session.flush()

    result = await retention.purge(session, now=now)

    assert result["signals"] == 2
    assert result["logs"] == 1
    assert await _count(session, ActivitySignal) == 1
    assert await _count(session, NotificationLog) == 1

    left = await session.scalar(select(NotificationLog.title))
    assert left == "최근 것"


@pytest.mark.asyncio
async def test_purge_is_safe_when_nothing_is_old(client, session):
    _gt, _st, _senior_id = await _family(client)
    result = await retention.purge(session)
    assert result == {"signals": 0, "logs": 0, "plans": 0}
