"""이상 징후 룰 검증 — 계획서 8.2 의 핵심 로직."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import settings
from app.models.enums import AlertSeverity, AlertType, DevicePlatform, UserRole
from app.models.user import Device, Family, FamilyMember, User
from app.services import alert_engine


async def _make_senior(session, last_seen: datetime) -> User:
    guardian = User(phone=f"010{uuid.uuid4().int % 10**8:08d}", name="자녀", role=UserRole.GUARDIAN)
    senior = User(phone=f"010{uuid.uuid4().int % 10**8:08d}", name="어머니", role=UserRole.SENIOR)
    session.add_all([guardian, senior])
    await session.flush()

    family = Family(name="테스트 가족", created_by=guardian.id)
    session.add(family)
    await session.flush()

    session.add_all(
        [
            FamilyMember(family_id=family.id, user_id=guardian.id, role=UserRole.GUARDIAN),
            FamilyMember(family_id=family.id, user_id=senior.id, role=UserRole.SENIOR),
            Device(
                user_id=senior.id,
                platform=DevicePlatform.ANDROID,
                push_token=str(uuid.uuid4()),
                last_seen_at=last_seen,
            ),
        ]
    )
    await session.flush()
    return senior


@pytest.mark.asyncio
async def test_no_response_creates_high_alert(session):
    silent = datetime.now(UTC) - timedelta(hours=settings.NO_RESPONSE_HOURS + 1)
    senior = await _make_senior(session, silent)

    created = await alert_engine.scan(session)

    assert len(created) == 1
    assert created[0].target_user_id == senior.id
    assert created[0].type is AlertType.NO_RESPONSE
    assert created[0].severity is AlertSeverity.HIGH


@pytest.mark.asyncio
async def test_recent_activity_creates_no_alert(session):
    await _make_senior(session, datetime.now(UTC) - timedelta(hours=1))

    created = await alert_engine.scan(session)

    # 최근 응답이 있으면 HIGH 는 안 뜬다. 체크가 없으니 MEDIUM 은 뜰 수 있다.
    assert all(a.type is not AlertType.NO_RESPONSE for a in created)


@pytest.mark.asyncio
async def test_alert_not_duplicated_until_acked(session):
    silent = datetime.now(UTC) - timedelta(hours=settings.NO_RESPONSE_HOURS + 1)
    await _make_senior(session, silent)

    first = await alert_engine.scan(session)
    second = await alert_engine.scan(session)

    assert len(first) == 1
    assert second == []  # ack 전까지 재생성하지 않는다
