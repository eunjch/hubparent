"""일일 리포트 — 계획서 8.4.

summarize() 는 하루를 읽기만 하고, build_for_user() 가 그 결과를 daily_reports 에 남긴다.
화면 G1 은 오늘치를 summarize() 로 바로 계산하고(아직 21시 전이므로),
지난 날짜는 저장된 행을 읽는다.
"""

import uuid
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.care import MealCheck, MedicationLog, MoodCheck
from app.models.enums import (
    ActivityLevel,
    CheckSlot,
    MealStatus,
    MedicationStatus,
    MoodValue,
    UserRole,
)
from app.models.monitor import ActivitySignal, DailyReport
from app.models.user import FamilyMember
from app.services import medication as med_service

# 걸음 수 기준 활동 수준. 고령층 기준이라 일반 성인보다 낮게 잡는다.
STEPS_HIGH = 3000
STEPS_NORMAL = 800

ENCOURAGEMENT = {
    "good": "오늘도 잘 지내셨어요!",
    "partial": "오늘도 수고하셨어요.",
    "low": "내일은 조금 더 챙겨보아요.",
}


@dataclass
class DaySummary:
    report_date: date
    meal_done: int = 0
    med_taken: int = 0
    med_total: int = 0
    moods: dict[CheckSlot, MoodValue] = field(default_factory=dict)
    steps: int = 0
    activity_level: ActivityLevel | None = None
    has_signals: bool = False
    summary_text: str = ""

    @property
    def mood(self) -> MoodValue | None:
        """당일 최빈값."""
        if not self.moods:
            return None
        return Counter(self.moods.values()).most_common(1)[0][0]

    @property
    def score(self) -> int:
        """0~100. 식사 3 + 기분 3 + 복약 n 중 채운 비율. 화면 링이 쓴다."""
        done = self.meal_done + len(self.moods) + self.med_taken
        total = 3 + 3 + self.med_total
        return round(done / total * 100)


def _activity_level(steps: int) -> ActivityLevel:
    if steps >= STEPS_HIGH:
        return ActivityLevel.HIGH
    if steps >= STEPS_NORMAL:
        return ActivityLevel.NORMAL
    return ActivityLevel.LOW


def day_bounds(report_date: date) -> tuple[datetime, datetime]:
    """KST 하루의 UTC 구간."""
    start = datetime.combine(report_date, datetime.min.time(), tzinfo=med_service.KST).astimezone(UTC)
    return start, start + timedelta(days=1)


async def summarize(session: AsyncSession, user_id: uuid.UUID, report_date: date) -> DaySummary:
    s = DaySummary(report_date=report_date)

    meals = await session.scalars(
        select(MealCheck.status).where(
            MealCheck.user_id == user_id, MealCheck.check_date == report_date
        )
    )
    s.meal_done = sum(1 for m in meals if m is MealStatus.ATE)

    moods = await session.execute(
        select(MoodCheck.slot, MoodCheck.mood).where(
            MoodCheck.user_id == user_id, MoodCheck.check_date == report_date
        )
    )
    s.moods = {slot: mood for slot, mood in moods.all()}

    # 복약은 규칙을 펼친 건수가 분모다. 응답이 없는 건도 세야 "1/3" 이 된다.
    doses = await med_service.with_status(session, user_id, report_date)
    s.med_total = len(doses)
    s.med_taken = sum(1 for _, status in doses if status is MedicationStatus.TAKEN)

    day_start, day_end = day_bounds(report_date)
    steps = await session.scalar(
        select(func.coalesce(func.sum(ActivitySignal.step_count), 0)).where(
            ActivitySignal.user_id == user_id,
            ActivitySignal.recorded_at >= day_start,
            ActivitySignal.recorded_at < day_end,
        )
    )
    signal_count = await session.scalar(
        select(func.count())
        .select_from(ActivitySignal)
        .where(
            ActivitySignal.user_id == user_id,
            ActivitySignal.recorded_at >= day_start,
            ActivitySignal.recorded_at < day_end,
        )
    )
    s.steps = int(steps or 0)
    s.has_signals = (signal_count or 0) > 0
    # 신호가 하나도 없으면 "하" 가 아니라 "기록 없음" 이다 — 단말이 안 보낸 것일 수 있다
    s.activity_level = _activity_level(s.steps) if s.has_signals else None

    if s.meal_done >= 3 and (s.med_total == 0 or s.med_taken == s.med_total):
        s.summary_text = ENCOURAGEMENT["good"]
    elif s.meal_done >= 1:
        s.summary_text = ENCOURAGEMENT["partial"]
    else:
        s.summary_text = ENCOURAGEMENT["low"]
    return s


async def build_for_user(session: AsyncSession, user_id: uuid.UUID, report_date: date) -> DailyReport:
    s = await summarize(session, user_id, report_date)

    row = await session.scalar(
        select(DailyReport).where(
            DailyReport.user_id == user_id, DailyReport.report_date == report_date
        )
    )
    if row is None:
        row = DailyReport(user_id=user_id, report_date=report_date)
        session.add(row)

    row.meal_done = s.meal_done
    row.med_taken = s.med_taken
    row.med_total = s.med_total
    row.mood = s.mood
    row.activity_level = s.activity_level
    row.summary_text = s.summary_text

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


async def trend(session: AsyncSession, user_id: uuid.UUID, days: int = 7) -> list[tuple[date, int]]:
    """최근 days 일 점수. 저장된 리포트가 있으면 그것을, 없으면 그 자리에서 센다."""
    today = med_service.today_kst()
    dates = [today - timedelta(days=n) for n in range(days - 1, -1, -1)]

    saved = {
        r.report_date: r
        for r in await session.scalars(
            select(DailyReport).where(
                DailyReport.user_id == user_id, DailyReport.report_date.in_(dates)
            )
        )
    }

    out: list[tuple[date, int]] = []
    for d in dates:
        r = saved.get(d)
        if r is not None and d != today:
            # 저장 행에는 기분이 최빈값 하나뿐이라 기록 여부(0 또는 3)로 근사한다
            done = r.meal_done + r.med_taken + (3 if r.mood is not None else 0)
            total = 6 + r.med_total
            out.append((d, round(done / total * 100)))
        else:
            out.append((d, (await summarize(session, user_id, d)).score))
    return out
