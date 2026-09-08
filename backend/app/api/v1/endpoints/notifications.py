"""로컬 알림 — 단말이 예약 계획을 받아가고 결과를 보고한다 (계획서 8.5).

푸시가 주고 로컬은 보험이다. 그래서 이 API 는 단말 상태를 서버에 알리는 용도가 아니라,
단말이 "앞으로 2주치를 무엇으로 예약할지" 받아가는 용도다.
"""

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.models.notify import LocalNotification, NotificationLog
from app.schemas.common import Ok
from app.schemas.notification import LocalReport, PlanItem, PlanOut
from app.services import notification_plan, presence

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/plan", response_model=PlanOut)
async def plan(
    user: CurrentUser,
    session: DBSession,
    days: int = Query(default=notification_plan.DEFAULT_DAYS, ge=1, le=30),
) -> PlanOut:
    """본인 알림만 준다. 자녀 앱은 로컬 알림을 쓰지 않으므로 빈 목록을 받는다."""
    items, revoked = await notification_plan.sync(session, user.id, days)
    await presence.touch(session, user.id)
    return PlanOut(
        items=[
            PlanItem(
                local_id=r.id, at=r.fire_at, title=r.title, body=r.body, channel=r.channel, route=r.route
            )
            for r in items
        ],
        revoked_ids=revoked,
    )


@router.post("/report", response_model=Ok)
async def report(payload: LocalReport, user: CurrentUser, session: DBSession) -> Ok:
    """단말의 예약·발화·취소 결과. 중복 방지가 아니라 이력 확인용이다."""
    if not payload.events:
        return Ok()

    ids = {e.local_id for e in payload.events}
    known = {
        r.id: r
        for r in await session.scalars(
            select(LocalNotification).where(
                LocalNotification.user_id == user.id, LocalNotification.id.in_(ids)
            )
        )
    }
    session.add_all(
        [
            NotificationLog(
                user_id=user.id,
                kind="local",
                event=e.event,
                channel=known[e.local_id].channel if e.local_id in known else None,
                title=known[e.local_id].title if e.local_id in known else None,
                local_id=e.local_id,
                at=e.at,
            )
            for e in payload.events
        ]
    )
    await presence.touch(session, user.id)
    return Ok()
