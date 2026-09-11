"""보관 기간이 지난 기록 파기 — 계획서 5.2 · 11장 · 개인정보처리방침 3절.

방침에 **알림 발송 이력 90일**, **생활 신호 원본 90일** 이라고 공개해 두었다.
그 약속을 지키는 코드가 없어 두 테이블이 무한히 쌓이고 있었다 (2026-09-11 점검).

원본을 지워도 그날의 요약은 남는다 — `daily_reports` 를 매일 21:00 에 만들어 두기
때문이다(services.report.build_all). 그래서 여기서는 접는 작업 없이 버리기만 한다.

**주의**: `notification_logs` 는 이력이자 **중복 방지 저장소**다(services.push.already_sent).
지금 쓰는 키는 전부 시각·날짜·UUID 를 담고 있어 90일 뒤에 다시 울릴 일이 없지만,
키에서 시각을 빼는 순간 그 안전이 깨진다. 키를 바꿀 때 이 파일을 함께 볼 것.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.monitor import ActivitySignal
from app.models.notify import LocalNotification, NotificationLog

log = logging.getLogger("hubfamily.retention")

KEEP_DAYS = 90


async def purge(session: AsyncSession, now: datetime | None = None) -> dict[str, int]:
    """보관 기간이 지난 것을 지운다. 무엇을 얼마나 지웠는지 돌려준다."""
    now = now or datetime.now(UTC)
    cutoff = now - timedelta(days=KEEP_DAYS)

    signals = (
        await session.execute(delete(ActivitySignal).where(ActivitySignal.recorded_at < cutoff))
    ).rowcount or 0
    logs = (
        await session.execute(delete(NotificationLog).where(NotificationLog.at < cutoff))
    ).rowcount or 0
    # 지난 로컬 알림 계획은 들고 있을 이유가 없다
    plans = (
        await session.execute(delete(LocalNotification).where(LocalNotification.fire_at < cutoff))
    ).rowcount or 0

    await session.flush()
    return {"signals": signals, "logs": logs, "plans": plans}
