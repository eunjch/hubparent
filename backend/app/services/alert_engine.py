"""이상 징후 감지 — 계획서 8.2.

MVP 는 룰 기반이다. AI 패턴 분석은 STAGE 2.

  HIGH    devices.last_seen_at 이 NO_RESPONSE_HOURS(24시간)를 넘음
  MEDIUM  하루 체크 3종 전부 미입력 + 활동 신호 없음

같은 유형의 알림은 보호자가 확인(ack)하기 전까지 다시 만들지 않는다.
휴대폰 방전·기기 미소지로 인한 오탐이 있을 수 있어 문구에 참고용임을 명시한다.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.care import MealCheck, MoodCheck
from app.models.enums import AlertSeverity, AlertType, UserRole
from app.models.monitor import ActivitySignal, Alert
from app.models.user import Device, FamilyMember

DISCLAIMER = "의료적 진단이 아닌 참고용 정보입니다."


def _as_utc(value: datetime) -> datetime:
    """DB 에서 온 시각을 aware UTC 로 맞춘다.

    PostgreSQL 은 timezone 을 보존하지만 테스트용 SQLite 는 naive 로 돌려준다.
    저장은 항상 UTC 이므로(계획서 5.2) naive 면 UTC 로 간주한다.
    """
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


async def _has_open_alert(session: AsyncSession, user_id: uuid.UUID, type_: AlertType) -> bool:
    row = await session.scalar(
        select(Alert.id).where(
            Alert.target_user_id == user_id,
            Alert.type == type_,
            Alert.ack_at.is_(None),
        )
    )
    return row is not None


async def _family_of(session: AsyncSession, user_id: uuid.UUID) -> uuid.UUID | None:
    return await session.scalar(
        select(FamilyMember.family_id).where(FamilyMember.user_id == user_id).limit(1)
    )


async def scan(session: AsyncSession) -> list[Alert]:
    """worker 가 ALERT_SCAN_INTERVAL_MINUTES 주기로 호출한다."""
    now = datetime.now(UTC)
    created: list[Alert] = []

    seniors = await session.execute(
        select(FamilyMember.user_id, FamilyMember.family_id).where(
            FamilyMember.role == UserRole.SENIOR
        )
    )

    for user_id, family_id in seniors.all():
        last_seen = await session.scalar(
            select(func.max(Device.last_seen_at)).where(Device.user_id == user_id)
        )

        # ── HIGH: 장시간 미응답 ────────────────────────────────
        if last_seen is not None:
            silent_for = now - _as_utc(last_seen)
            if silent_for >= timedelta(hours=settings.NO_RESPONSE_HOURS):
                if not await _has_open_alert(session, user_id, AlertType.NO_RESPONSE):
                    hours = int(silent_for.total_seconds() // 3600)
                    alert = Alert(
                        family_id=family_id,
                        target_user_id=user_id,
                        type=AlertType.NO_RESPONSE,
                        severity=AlertSeverity.HIGH,
                        message=f"{hours}시간 동안 응답이 없어요. {DISCLAIMER}",
                        occurred_at=now,
                    )
                    session.add(alert)
                    created.append(alert)
                continue  # HIGH 가 떴으면 MEDIUM 은 보지 않는다

        # ── MEDIUM: 하루 체크 전무 + 활동 신호 없음 ────────────
        today = now.date()
        meal_count = await session.scalar(
            select(func.count())
            .select_from(MealCheck)
            .where(MealCheck.user_id == user_id, MealCheck.check_date == today)
        )
        mood_count = await session.scalar(
            select(func.count())
            .select_from(MoodCheck)
            .where(MoodCheck.user_id == user_id, MoodCheck.check_date == today)
        )
        signal_count = await session.scalar(
            select(func.count())
            .select_from(ActivitySignal)
            .where(
                ActivitySignal.user_id == user_id,
                ActivitySignal.recorded_at >= now - timedelta(hours=12),
            )
        )

        quiet_day = (meal_count or 0) == 0 and (mood_count or 0) == 0 and (signal_count or 0) == 0
        if quiet_day and not await _has_open_alert(session, user_id, AlertType.NO_CHECKS):
            alert = Alert(
                family_id=family_id,
                target_user_id=user_id,
                type=AlertType.NO_CHECKS,
                severity=AlertSeverity.MEDIUM,
                message=f"오늘 아직 아무 기록이 없어요. {DISCLAIMER}",
                occurred_at=now,
            )
            session.add(alert)
            created.append(alert)

    await session.flush()
    return created
