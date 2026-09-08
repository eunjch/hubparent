"""이상 징후 알림 — 화면 G2 (계획서 8.2).

보호자만 본다. 필터: 전체 / 이상 징후(high·medium) / 일반(low).
확인(ack)하면 같은 유형이 다시 생길 수 있다 — 감지 엔진의 중복 방지 기준이 ack 다.
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession, require_guardian, shared_family_ids
from app.core.errors import NotFound
from app.models.enums import AlertSeverity
from app.models.monitor import Alert
from app.models.user import User
from app.schemas.alert import AckAllIn, AlertListOut, AlertOut
from app.schemas.common import Ok

router = APIRouter(prefix="/alerts", tags=["alerts"], dependencies=[Depends(require_guardian)])

ANOMALY = (AlertSeverity.HIGH, AlertSeverity.MEDIUM)


def _out(row: Alert, name: str) -> AlertOut:
    return AlertOut(
        id=row.id,
        target_user_id=row.target_user_id,
        target_name=name,
        type=row.type,
        severity=row.severity,
        message=row.message,
        occurred_at=row.occurred_at,
        ack_at=row.ack_at,
    )


@router.get("", response_model=AlertListOut)
async def list_alerts(
    user: CurrentUser,
    session: DBSession,
    filter: str = Query(default="all", pattern="^(all|anomaly|general)$"),
    user_id: uuid.UUID | None = Query(default=None, description="비우면 가족 전체"),
    limit: int = Query(default=50, ge=1, le=200),
) -> AlertListOut:
    families = await shared_family_ids(session, user.id)
    if not families:
        return AlertListOut(items=[], unread=0)

    query = select(Alert, User.name).join(User, User.id == Alert.target_user_id).where(
        Alert.family_id.in_(families)
    )
    if user_id is not None:
        query = query.where(Alert.target_user_id == user_id)
    if filter == "anomaly":
        query = query.where(Alert.severity.in_(ANOMALY))
    elif filter == "general":
        query = query.where(Alert.severity == AlertSeverity.LOW)

    rows = (await session.execute(query.order_by(Alert.occurred_at.desc()).limit(limit))).all()

    unread_query = select(Alert.id).where(Alert.family_id.in_(families), Alert.ack_at.is_(None))
    if user_id is not None:
        unread_query = unread_query.where(Alert.target_user_id == user_id)
    unread = len((await session.scalars(unread_query)).all())

    return AlertListOut(items=[_out(a, name) for a, name in rows], unread=unread)


@router.post("/{alert_id}/ack", response_model=AlertOut)
async def ack_alert(alert_id: uuid.UUID, user: CurrentUser, session: DBSession) -> AlertOut:
    families = await shared_family_ids(session, user.id)
    row = await session.scalar(
        select(Alert).where(Alert.id == alert_id, Alert.family_id.in_(families))
    )
    if row is None:
        raise NotFound("ALERT_NOT_FOUND", "알림을 찾을 수 없습니다.")

    if row.ack_at is None:
        row.ack_at = datetime.now(UTC)
        row.ack_by = user.id
        await session.flush()

    name = await session.scalar(select(User.name).where(User.id == row.target_user_id))
    return _out(row, name or "")


@router.post("/ack-all", response_model=Ok)
async def ack_all(payload: AckAllIn, user: CurrentUser, session: DBSession) -> Ok:
    """화면 G2 의 `모두 확인했어요`."""
    families = await shared_family_ids(session, user.id)
    query = select(Alert).where(Alert.family_id.in_(families), Alert.ack_at.is_(None))
    if payload.user_id is not None:
        query = query.where(Alert.target_user_id == payload.user_id)

    now = datetime.now(UTC)
    for row in await session.scalars(query):
        row.ack_at = now
        row.ack_by = user.id
    await session.flush()
    return Ok()
