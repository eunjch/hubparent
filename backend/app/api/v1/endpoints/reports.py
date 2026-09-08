"""리포트 — 화면 G1 이 읽는다 (계획서 8.4).

보호자가 어르신 건강정보를 보는 자리이므로 감사 로그를 남긴다 (계획서 11장).
"""

import uuid
from datetime import date

from fastapi import APIRouter, Query, Request
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession, assert_family_access, client_ip
from app.core.timeutil import as_utc, now
from app.models.monitor import ActivitySignal, Alert
from app.models.ops import AuditLog
from app.schemas.report import (
    ActivityReportOut,
    FamilyReportOut,
    HourBucket,
    MoodEntry,
    TrendPoint,
)
from app.services import medication as med_service
from app.services import report as report_service

router = APIRouter(prefix="/reports", tags=["reports"])


async def _audit(session: DBSession, request: Request, actor: CurrentUser, target: uuid.UUID, what: str) -> None:
    if actor.id == target:
        return
    session.add(
        AuditLog(
            actor_id=actor.id,
            action=what,
            target_type="user",
            target_id=str(target),
            ip=client_ip(request),
            at=now(),
        )
    )


@router.get("/family/{user_id}", response_model=FamilyReportOut)
async def family_report(
    user_id: uuid.UUID,
    request: Request,
    user: CurrentUser,
    session: DBSession,
    report_date: date | None = Query(default=None, description="비우면 오늘(KST)"),
) -> FamilyReportOut:
    await assert_family_access(session, user, user_id)
    await _audit(session, request, user, user_id, "view_report")

    day = report_date or med_service.today_kst()
    s = await report_service.summarize(session, user_id, day)
    trend = await report_service.trend(session, user_id)

    unread = await session.scalar(
        select(func.count())
        .select_from(Alert)
        .where(Alert.target_user_id == user_id, Alert.ack_at.is_(None))
    )

    return FamilyReportOut(
        user_id=user_id,
        report_date=day,
        score=s.score,
        meal_done=s.meal_done,
        med_taken=s.med_taken,
        med_total=s.med_total,
        moods=[MoodEntry(slot=slot, mood=mood) for slot, mood in s.moods.items()],
        activity_level=s.activity_level,
        steps=s.steps,
        summary_text=s.summary_text,
        trend=[TrendPoint(date=d, score=score) for d, score in trend],
        unread_alerts=unread or 0,
    )


@router.get("/activity/{user_id}", response_model=ActivityReportOut)
async def activity_report(
    user_id: uuid.UUID,
    request: Request,
    user: CurrentUser,
    session: DBSession,
    report_date: date | None = Query(default=None),
) -> ActivityReportOut:
    """시간대별 활동량. 화면 G1 의 막대그래프(06/12/18/24시)가 쓴다."""
    await assert_family_access(session, user, user_id)
    await _audit(session, request, user, user_id, "view_activity")

    day = report_date or med_service.today_kst()
    start, end = report_service.day_bounds(day)

    rows = await session.execute(
        select(ActivitySignal.recorded_at, ActivitySignal.step_count, ActivitySignal.screen_on_count).where(
            ActivitySignal.user_id == user_id,
            ActivitySignal.recorded_at >= start,
            ActivitySignal.recorded_at < end,
        )
    )
    buckets = [HourBucket(hour=h, steps=0, screen_on=0) for h in range(24)]
    for recorded_at, steps, screen_on in rows.all():
        h = as_utc(recorded_at).astimezone(med_service.KST).hour
        buckets[h].steps += steps
        buckets[h].screen_on += screen_on

    s = await report_service.summarize(session, user_id, day)
    return ActivityReportOut(
        user_id=user_id, report_date=day, activity_level=s.activity_level, steps=s.steps, hours=buckets
    )
