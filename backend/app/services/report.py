"""일일 리포트 생성 — 계획서 8.4.

매일 DAILY_REPORT_HOUR(21시 KST)에 어르신별로 하루를 집계한다.
화면 6(어르신)과 화면 7(자녀)이 같은 행을 읽는다.
"""

import uuid
from collections import Counter
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.care import MealCheck, MedicationLog, MoodCheck
from app.models.enums import ActivityLevel, MealStatus, MedicationStatus, MoodValue, UserRole
from app.models.monitor import ActivitySignal, DailyReport
from app.models.user import FamilyMember

# 걸음 수 기준 활동 수준. 고령층 기준이라 일반 성인보다 낮게 잡는다.
STEPS_HIGH = 3000
STEPS_NORMAL = 800

ENCOURAGEMENT = {
    "good": "오늘도 잘 지내셨어요!",
    "partial": "오늘도 수고하셨어요.",
    "low": "내일은 조금 더 챙겨보아요.",
}


def _activity_level(steps: int) -> ActivityLevel:
    if steps >= STEPS_HIGH:
        return ActivityLevel.HIGH
    if steps >= STEPS_NORMAL:
        return ActivityLevel.NORMAL
    return ActivityLevel.LOW


async def build_for_user(session: AsyncSession, user_id: uuid.UUID, report_date: date) -> DailyReport:
    meals = list(
        await session.scalars(
            select(MealCheck).where(
                MealCheck.user_id == user_id, MealCheck.check_date == report_date
            )
        )
    )
    meal_done = sum(1 for m in meals if m.status is MealStatus.ATE)

    moods = list(
        await session.scalars(
            select(MoodCheck.mood).where(
                MoodCheck.user_id == user_id, MoodCheck.check_date == report_date
            )
        )
    )
    mood: MoodValue | None = Counter(moods).most_common(1)[0][0] if moods else None

    day_start = datetime.combine(report_date, datetime.min.time(), tzinfo=UTC)
    day_end = day_start + timedelta(days=1)

    logs = list(
        await session.scalars(
            select(MedicationLog).where(
                MedicationLog.user_id == user_id,
                MedicationLog.scheduled_at >= day_start,
                MedicationLog.scheduled_at < day_end,
            )
        )
    )
    med_total = len(logs)
    med_taken = sum(1 for lg in logs if lg.status is MedicationStatus.TAKEN)

    steps = await session.scalar(
        select(func.coalesce(func.sum(ActivitySignal.step_count), 0)).where(
            ActivitySignal.user_id == user_id,
            ActivitySignal.recorded_at >= day_start,
            ActivitySignal.recorded_at < day_end,
        )
    )
    level = _activity_level(int(steps or 0))

    if meal_done >= 3 and (med_total == 0 or med_taken == med_total):
        summary = ENCOURAGEMENT["good"]
    elif meal_done >= 1:
        summary = ENCOURAGEMENT["partial"]
    else:
        summary = ENCOURAGEMENT["low"]

    row = await session.scalar(
        select(DailyReport).where(
            DailyReport.user_id == user_id, DailyReport.report_date == report_date
        )
    )
    if row is None:
        row = DailyReport(user_id=user_id, report_date=report_date)
        session.add(row)

    row.meal_done = meal_done
    row.med_taken = med_taken
    row.med_total = med_total
    row.mood = mood
    row.activity_level = level
    row.summary_text = summary

    await session.flush()
    return row


async def build_all(session: AsyncSession, report_date: date) -> int:
    """모든 어르신의 리포트를 만든다. 생성 건수를 돌려준다."""
    senior_ids = list(
        await session.scalars(
            select(FamilyMember.user_id).where(FamilyMember.role == UserRole.SENIOR)
        )
    )
    for user_id in senior_ids:
        await build_for_user(session, user_id, report_date)
    return len(senior_ids)
