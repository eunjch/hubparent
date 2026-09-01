"""백그라운드 worker.

api 와 별도 컨테이너로 뜬다 (deploy/docker-compose.yml 의 worker 서비스).
실행:  python -m app.workers.scheduler
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.db import SessionFactory
from app.services import alert_engine, report

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s | %(message)s",
)
log = logging.getLogger("hubfamily.worker")

KST = ZoneInfo(settings.APP_TIMEZONE)


async def scan_alerts() -> None:
    async with SessionFactory() as session:
        created = await alert_engine.scan(session)
        await session.commit()
    if created:
        log.info("이상 징후 알림 %d건 생성", len(created))
        # TODO(M3): 생성된 알림을 보호자 단말로 푸시 발송


async def make_daily_reports() -> None:
    """21:00 KST 기준. 그 시점에는 '오늘' 하루가 거의 끝났으므로 당일을 집계한다."""
    today = datetime.now(KST).date()
    async with SessionFactory() as session:
        count = await report.build_all(session, today)
        await session.commit()
    log.info("일일 리포트 %d건 생성 (%s)", count, today)
    # TODO(M3): 보호자에게 요약 푸시 1건 발송


async def close_missed_medications() -> None:
    """L3 — 당일 마감까지 응답 없는 복약 로그를 missed 로 확정한다.

    medications 라우터가 붙는 M3 에서 채운다 — 계획서 8.1.
    """
    _ = datetime.now(UTC) - timedelta(days=1)


def main() -> None:
    scheduler = AsyncIOScheduler(timezone=KST)

    scheduler.add_job(
        scan_alerts,
        IntervalTrigger(minutes=settings.ALERT_SCAN_INTERVAL_MINUTES),
        id="scan_alerts",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        make_daily_reports,
        CronTrigger(hour=settings.DAILY_REPORT_HOUR, minute=0),
        id="daily_reports",
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()
    log.info(
        "worker 시작 — 이상징후 %d분 주기, 일일리포트 %02d:00 %s",
        settings.ALERT_SCAN_INTERVAL_MINUTES,
        settings.DAILY_REPORT_HOUR,
        settings.APP_TIMEZONE,
    )

    loop = asyncio.get_event_loop()
    try:
        loop.run_forever()
    except (KeyboardInterrupt, SystemExit):
        log.info("worker 종료")


if __name__ == "__main__":
    main()
