"""일정 — 자녀가 등록하고(G3) 어르신은 확인만 한다(S5).

계획서 7.3: 어르신 화면은 읽기 전용이다. 등록·수정·삭제는 보호자 권한이다.
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession, assert_family_access, require_guardian
from app.core.errors import NotFound
from app.core.timeutil import as_utc
from app.models.care import Schedule
from app.models.user import FamilyMember
from app.schemas.common import Ok
from app.schemas.schedule import ScheduleCreate, ScheduleOut, ScheduleUpdate

router = APIRouter(tags=["schedules"])


def _out(row: Schedule) -> ScheduleOut:
    return ScheduleOut(
        id=row.id,
        target_user_id=row.target_user_id,
        title=row.title,
        kind=row.kind,
        start_at=row.start_at,
        place=row.place,
        reminder_minutes=row.reminder_minutes or [],
        notified_at=row.notified_at,
        upcoming=as_utc(row.start_at) >= datetime.now(UTC),
    )


async def _owned(session: DBSession, user: CurrentUser, schedule_id: uuid.UUID) -> Schedule:
    row = await session.get(Schedule, schedule_id)
    if row is None:
        raise NotFound("SCHEDULE_NOT_FOUND", "일정을 찾을 수 없습니다.")
    await assert_family_access(session, user, row.target_user_id)
    return row


@router.get("/schedules", response_model=list[ScheduleOut])
async def list_schedules(
    user: CurrentUser,
    session: DBSession,
    user_id: uuid.UUID | None = Query(default=None, description="비우면 본인 것"),
    scope: str = Query(default="all", pattern="^(all|upcoming)$"),
) -> list[ScheduleOut]:
    """`scope=upcoming` 이면 지나지 않은 일정만. 시안 S5 의 세그먼트 탭이 쓴다."""
    target = user_id or user.id
    await assert_family_access(session, user, target)

    query = select(Schedule).where(Schedule.target_user_id == target)
    if scope == "upcoming":
        query = query.where(Schedule.start_at >= datetime.now(UTC))

    rows = await session.scalars(query.order_by(Schedule.start_at))
    return [_out(r) for r in rows]


@router.post("/schedules", response_model=ScheduleOut, dependencies=[Depends(require_guardian)])
async def create_schedule(
    payload: ScheduleCreate, user: CurrentUser, session: DBSession
) -> ScheduleOut:
    await assert_family_access(session, user, payload.target_user_id)

    family_id = await session.scalar(
        select(FamilyMember.family_id).where(FamilyMember.user_id == user.id).limit(1)
    )
    if family_id is None:
        raise NotFound("NO_FAMILY", "가족 정보를 찾을 수 없습니다.")

    row = Schedule(
        family_id=family_id,
        target_user_id=payload.target_user_id,
        created_by=user.id,
        title=payload.title.strip(),
        kind=payload.kind,
        start_at=as_utc(payload.start_at),
        place=payload.place,
        reminder_minutes=payload.reminder_minutes,
    )
    session.add(row)
    await session.flush()

    # TODO(M3): 부모님 단말에 무음 푸시로 재동기화 신호를 보낸다 (계획서 8.5.1)
    return _out(row)


@router.patch(
    "/schedules/{schedule_id}", response_model=ScheduleOut, dependencies=[Depends(require_guardian)]
)
async def update_schedule(
    schedule_id: uuid.UUID, payload: ScheduleUpdate, user: CurrentUser, session: DBSession
) -> ScheduleOut:
    row = await _owned(session, user, schedule_id)

    values = payload.model_dump(exclude_none=True)
    if "start_at" in values:
        values["start_at"] = as_utc(values["start_at"])
    for field, value in values.items():
        setattr(row, field, value)

    # 시각이나 알림이 바뀌면 단말의 로컬 알림 예약도 바뀐다 (계획서 8.5.5 revoked_ids)
    await session.flush()
    return _out(row)


@router.delete(
    "/schedules/{schedule_id}", response_model=Ok, dependencies=[Depends(require_guardian)]
)
async def delete_schedule(schedule_id: uuid.UUID, user: CurrentUser, session: DBSession) -> Ok:
    row = await _owned(session, user, schedule_id)
    await session.delete(row)
    return Ok()


@router.post(
    "/schedules/{schedule_id}/notify",
    response_model=ScheduleOut,
    dependencies=[Depends(require_guardian)],
)
async def notify_schedule(
    schedule_id: uuid.UUID, user: CurrentUser, session: DBSession
) -> ScheduleOut:
    """화면 G3 의 `부모님에게 알림 전송`.

    지금은 보낸 시각만 남긴다. 실제 발송은 푸시가 붙는 M3 에서 채운다.
    """
    row = await _owned(session, user, schedule_id)
    row.notified_at = datetime.now(UTC)
    await session.flush()

    # TODO(M3): 부모님 단말로 알림 푸시 발송
    return _out(row)
