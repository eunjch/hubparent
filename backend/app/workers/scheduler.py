"""백그라운드 worker.

api 와 별도 컨테이너로 뜬다 (deploy/docker-compose.yml 의 worker 서비스).
실행:  python -m app.workers.scheduler

작업
  복약 알림       1분 주기   정각 푸시 (재알림 L1/L2 는 MED_ESCALATION 로 보류)
  일정 알림       1분 주기   사전 알림 시각이 된 일정을 푸시
  이상 징후       15분 주기  감지 후 보호자 푸시 (services.alert_engine)
  일일 리포트     21:00 KST  집계 + 보호자 요약 푸시
  복약 마감       00:10 KST  전날 미응답 건 missed 확정 (L3)
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionFactory
from app.core.timeutil import as_utc
from app.models.care import Schedule
from app.models.enums import ActivityLevel
from app.services import alert_engine, medication_reminder, notification_plan, push, report

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s | %(message)s",
)
log = logging.getLogger("hubfamily.worker")

KST = ZoneInfo(settings.APP_TIMEZONE)
# 알림은 서버 푸시 하나뿐이라(로컬 알람 없음) 정각에 가깝게 1분 주기
REMIND_INTERVAL_MINUTES = 1

# 방해 금지 — 하루 요약 같은 일반 알림은 이 시간을 피한다 (계획서 8.5.10)
QUIET_START, QUIET_END = 22, 7

LEVEL_LABEL = {ActivityLevel.HIGH: "활발", ActivityLevel.NORMAL: "보통", ActivityLevel.LOW: "적음"}


def in_quiet_hours(now_kst: datetime) -> bool:
    return now_kst.hour >= QUIET_START or now_kst.hour < QUIET_END


async def remind_medications() -> None:
    async with SessionFactory() as session:
        sent = await medication_reminder.remind(session)
        await session.commit()
    if sent:
        log.info("복약 알림 %d건", sent)


async def remind_schedules() -> None:
    """사전 알림 시각이 지난 지 REMIND_INTERVAL 안인 일정을 어르신에게 푸시한다."""
    now = datetime.now(UTC)
    window = timedelta(minutes=REMIND_INTERVAL_MINUTES)
    sent = 0

    async with SessionFactory() as session:
        rows = await session.scalars(
            select(Schedule).where(
                Schedule.start_at >= now - timedelta(minutes=1),
                Schedule.start_at <= now + timedelta(days=2),
            )
        )
        for sch in rows:
            start = as_utc(sch.start_at)
            for minutes in sch.reminder_minutes or []:
                fire_at = start - timedelta(minutes=minutes)
                if fire_at <= now < fire_at + window:
                    await push.send(
                        session,
                        sch.target_user_id,
                        title=notification_plan.REMINDER_TITLE.get(minutes, "일정이 있어요"),
                        body=notification_plan.schedule_body(sch),
                        channel="schedule",
                        route="/s/schedule",
                        dedupe_key=f"schedule:{sch.id}:{minutes}",
                    )
                    sent += 1
        await session.commit()
    if sent:
        log.info("일정 알림 %d건", sent)


async def scan_alerts() -> None:
    async with SessionFactory() as session:
        created = await alert_engine.scan(session)
        for alert in created:
            # 이상 징후는 방해 금지 시간에도 보낸다 — 그 시간에 알리는 것이 목적이다
            await push.send_to_guardians(
                session,
                alert.family_id,
                title="이상 징후 감지",
                body=alert.message,
                channel="anomaly",
                route="/g/alerts",
                dedupe_key=f"alert:{alert.id}",
            )
        await session.commit()
    if created:
        log.info("이상 징후 알림 %d건 생성", len(created))


async def make_daily_reports() -> None:
    """21:00 KST 기준. 그 시점에는 '오늘' 하루가 거의 끝났으므로 당일을 집계한다."""
    now_kst = datetime.now(KST)
    today = now_kst.date()

    async with SessionFactory() as session:
        count = await report.build_all(session, today)

        if not in_quiet_hours(now_kst):
            for user_id, family_id in await medication_reminder._seniors(session):
                s = await report.summarize(session, user_id, today)
                med = f"약 {s.med_taken}/{s.med_total}" if s.med_total else "약 없음"
                act = LEVEL_LABEL.get(s.activity_level, "기록 없음") if s.activity_level else "기록 없음"
                await push.send_to_guardians(
                    session,
                    family_id,
                    title="오늘의 부모님 하루 요약",
                    body=f"식사 {s.meal_done}/3 · {med} · 활동 {act}",
                    channel="report",
                    route="/g/home",
                    dedupe_key=f"daily:{user_id}:{today.isoformat()}",
                )
        await session.commit()
    log.info("일일 리포트 %d건 생성 (%s)", count, today)


async def close_missed_medications() -> None:
    """L3 — 전날 답 없는 복약 건을 missed 로 확정한다."""
    yesterday = datetime.now(KST).date() - timedelta(days=1)
    async with SessionFactory() as session:
        closed = await medication_reminder.close_day(session, yesterday)
        await session.commit()
    if closed:
        log.info("복약 미응답 %d건 missed 확정 (%s)", closed, yesterday)


async def run() -> None:
    """AsyncIOScheduler 는 실행 중인 이벤트 루프 안에서 start() 해야 한다."""
    scheduler = AsyncIOScheduler(timezone=KST)
    common = {"max_instances": 1, "coalesce": True}

    scheduler.add_job(
        remind_medications, IntervalTrigger(minutes=REMIND_INTERVAL_MINUTES), id="remind_medications", **common
    )
    scheduler.add_job(
        remind_schedules, IntervalTrigger(minutes=REMIND_INTERVAL_MINUTES), id="remind_schedules", **common
    )
    scheduler.add_job(
        scan_alerts,
        IntervalTrigger(minutes=settings.ALERT_SCAN_INTERVAL_MINUTES),
        id="scan_alerts",
        **common,
    )
    scheduler.add_job(
        make_daily_reports,
        CronTrigger(hour=settings.DAILY_REPORT_HOUR, minute=0),
        id="daily_reports",
        **common,
    )
    scheduler.add_job(
        close_missed_medications, CronTrigger(hour=0, minute=10), id="close_missed", **common
    )

    scheduler.start()
    log.info(
        "worker 시작 — 복약·일정 %d분, 이상징후 %d분, 일일리포트 %02d:00 %s",
        REMIND_INTERVAL_MINUTES,
        settings.ALERT_SCAN_INTERVAL_MINUTES,
        settings.DAILY_REPORT_HOUR,
        settings.APP_TIMEZONE,
    )

    # 컨테이너가 살아 있는 동안 스케줄러를 유지한다
    await asyncio.Event().wait()


def main() -> None:
    try:
        asyncio.run(run())
    except (KeyboardInterrupt, SystemExit):
        log.info("worker 종료")


if __name__ == "__main__":
    main()
