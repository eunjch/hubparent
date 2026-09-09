"""복약 알림 에스컬레이션 — 계획서 8.1.

  L0  예정 시각        어르신에게 푸시
  L1  +30분  미응답    다시 푸시
  L2  +2시간 미응답    다시 푸시 + 보호자에게 알림
  L3  당일 마감        missed 로 확정, 보호자 화면(G2)에 일반 알림

응답이 없는 건은 medication_logs 에 pending 행으로 남기고 reminder_level 로
어디까지 보냈는지 기억한다. 어르신이 답하면 그 행이 taken/missed 로 바뀐다.
"""

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.care import MedicationLog
from app.models.enums import AlertSeverity, AlertType, MedicationStatus, UserRole
from app.models.monitor import Alert
from app.models.user import FamilyMember
from app.models.notify import NotificationLog
from app.services import medication as med_service
from app.services import notification_plan, push

TITLE = {
    0: "약 드실 시간이에요",
    1: "약 드셨나요?",
    2: "아직 약을 안 드셨어요",
}


async def _seniors(session: AsyncSession) -> list[tuple[uuid.UUID, uuid.UUID]]:
    rows = await session.execute(
        select(FamilyMember.user_id, FamilyMember.family_id).where(
            FamilyMember.role == UserRole.SENIOR
        )
    )
    return [(u, f) for u, f in rows.all()]


def _level_due(scheduled_at: datetime, now: datetime) -> int | None:
    """지금 시각에 보내야 할 최고 단계. 아직 예정 전이면 None."""
    if now < scheduled_at:
        return None
    if now >= scheduled_at + timedelta(minutes=settings.MED_REMIND_L2_MINUTES):
        return 2
    if now >= scheduled_at + timedelta(minutes=settings.MED_REMIND_L1_MINUTES):
        return 1
    return 0


async def remind(session: AsyncSession, now: datetime | None = None) -> int:
    """worker 가 몇 분 주기로 부른다. 보낸 푸시 수를 돌려준다."""
    now = now or datetime.now(UTC)
    today = now.astimezone(med_service.KST).date()
    sent = 0

    for user_id, family_id in await _seniors(session):
        for occ in await med_service.occurrences(session, user_id, today):
            due = _level_due(occ.scheduled_at, now)
            if due is None:
                continue
            # 재알림 보류 — 정각(L0)만 다룬다
            if due > 0 and not settings.MED_ESCALATION:
                continue

            log = await session.scalar(
                select(MedicationLog).where(
                    MedicationLog.medication_id == occ.medication.id,
                    MedicationLog.scheduled_at == occ.scheduled_at,
                )
            )
            if log is not None and log.status is not MedicationStatus.PENDING:
                continue  # 이미 답했다

            if log is None:
                log = MedicationLog(
                    medication_id=occ.medication.id,
                    user_id=user_id,
                    scheduled_at=occ.scheduled_at,
                    status=MedicationStatus.PENDING,
                    reminder_level=-1,
                )
                session.add(log)

            # 놓친 단계는 건너뛰고 지금 단계 하나만 보낸다 — 밀린 알림이 한꺼번에 울리면 안 된다
            if log.reminder_level >= due:
                continue

            med = occ.medication
            body = f"{med.name} {med.dose}" if med.dose else med.name

            # 정각(L0)은 단말 알람이 있으면 그쪽이 울린다 — 푸시까지 보내면 두 번 울린다.
            # 재알림(L1·L2)은 단말에 없으므로 늘 푸시다.
            if due == 0 and await notification_plan.device_has_alarm(
                session, user_id, "medication", med.id, occ.scheduled_at
            ):
                session.add(
                    NotificationLog(
                        user_id=user_id,
                        kind="push",
                        event="skipped",
                        channel="medication",
                        title=TITLE[0],
                        dedupe_key=f"med:{med.id}:{occ.scheduled_at.isoformat()}:L0",
                        at=now,
                        detail="단말에 로컬 알람 있음",
                    )
                )
                log.reminder_level = 0
                continue

            await push.send(
                session,
                user_id,
                title=TITLE[due],
                body=f"{occ.time_label} {body}",
                channel="medication",
                route="/s/med",
                dedupe_key=f"med:{med.id}:{occ.scheduled_at.isoformat()}:L{due}",
            )
            log.reminder_level = due
            sent += 1

            if due == 2:
                await push.send_to_guardians(
                    session,
                    family_id,
                    title="부모님이 아직 약을 안 드셨어요",
                    body=f"{occ.time_label} {body} — 2시간째 응답이 없어요",
                    channel="anomaly",
                    route="/g/alerts",
                    dedupe_key=f"med-guardian:{med.id}:{occ.scheduled_at.isoformat()}",
                )

    await session.flush()
    return sent


async def close_day(session: AsyncSession, day: date) -> int:
    """L3 — 하루가 끝나면 답 없는 건을 missed 로 확정한다. 확정 건수를 돌려준다.

    보호자에게는 일반 알림(low) 하나로 묶어 알린다.
    """
    closed = 0
    for user_id, family_id in await _seniors(session):
        missed_names: list[str] = []
        for occ in await med_service.occurrences(session, user_id, day):
            log = await session.scalar(
                select(MedicationLog).where(
                    MedicationLog.medication_id == occ.medication.id,
                    MedicationLog.scheduled_at == occ.scheduled_at,
                )
            )
            if log is None:
                log = MedicationLog(
                    medication_id=occ.medication.id,
                    user_id=user_id,
                    scheduled_at=occ.scheduled_at,
                    status=MedicationStatus.PENDING,
                )
                session.add(log)
            if log.status is not MedicationStatus.PENDING:
                continue  # 이미 답했다
            log.status = MedicationStatus.MISSED
            log.reminder_level = 3
            missed_names.append(f"{occ.time_label} {occ.medication.name}")
            closed += 1

        if missed_names:
            session.add(
                Alert(
                    family_id=family_id,
                    target_user_id=user_id,
                    type=AlertType.MISSED_MEDICATION,
                    severity=AlertSeverity.LOW,
                    message=f"{day.month}월 {day.day}일 복용 기록이 없어요: " + ", ".join(missed_names),
                    occurred_at=datetime.now(UTC),
                )
            )

    await session.flush()
    return closed
