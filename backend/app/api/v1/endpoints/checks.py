"""식사 체크(화면 2) · 기분 체크(화면 4).

(user, date, slot) 유니크 제약 위에서 upsert 로 동작한다.
어르신 단말은 오프라인 큐에 쌓았다가 재전송하므로 같은 요청이 여러 번 올 수 있다.
같은 값이면 그대로, 다른 값이면 마지막 입력으로 덮는다 — 되돌리기 UX 와도 맞는다 (계획서 9장).
"""

import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession, assert_family_access
from app.models.care import MealCheck, MoodCheck
from app.schemas.check import MealCheckIn, MealCheckOut, MoodCheckIn, MoodCheckOut
from app.services import presence

router = APIRouter(prefix="/checks", tags=["checks"])


@router.get("/meals", response_model=list[MealCheckOut])
async def list_meals(
    user: CurrentUser,
    session: DBSession,
    check_date: date = Query(default_factory=lambda: datetime.now(UTC).date()),
    user_id: uuid.UUID | None = None,
) -> list[MealCheckOut]:
    target = user_id or user.id
    await assert_family_access(session, user, target)
    rows = await session.scalars(
        select(MealCheck).where(MealCheck.user_id == target, MealCheck.check_date == check_date)
    )
    return [MealCheckOut.model_validate(r) for r in rows]


@router.post("/meals", response_model=MealCheckOut)
async def upsert_meal(payload: MealCheckIn, user: CurrentUser, session: DBSession) -> MealCheckOut:
    row = await session.scalar(
        select(MealCheck).where(
            MealCheck.user_id == user.id,
            MealCheck.check_date == payload.check_date,
            MealCheck.slot == payload.slot,
        )
    )
    now = datetime.now(UTC)
    if row is None:
        row = MealCheck(
            user_id=user.id,
            check_date=payload.check_date,
            slot=payload.slot,
            status=payload.status,
            checked_at=now,
        )
        session.add(row)
    else:
        row.status = payload.status
        row.checked_at = now

    await presence.touch(session, user.id)
    await session.flush()
    return MealCheckOut.model_validate(row)


@router.get("/moods", response_model=list[MoodCheckOut])
async def list_moods(
    user: CurrentUser,
    session: DBSession,
    check_date: date = Query(default_factory=lambda: datetime.now(UTC).date()),
    user_id: uuid.UUID | None = None,
) -> list[MoodCheckOut]:
    target = user_id or user.id
    await assert_family_access(session, user, target)
    rows = await session.scalars(
        select(MoodCheck).where(MoodCheck.user_id == target, MoodCheck.check_date == check_date)
    )
    return [MoodCheckOut.model_validate(r) for r in rows]


@router.post("/moods", response_model=MoodCheckOut)
async def upsert_mood(payload: MoodCheckIn, user: CurrentUser, session: DBSession) -> MoodCheckOut:
    row = await session.scalar(
        select(MoodCheck).where(
            MoodCheck.user_id == user.id,
            MoodCheck.check_date == payload.check_date,
            MoodCheck.slot == payload.slot,
        )
    )
    now = datetime.now(UTC)
    if row is None:
        row = MoodCheck(
            user_id=user.id,
            check_date=payload.check_date,
            slot=payload.slot,
            mood=payload.mood,
            checked_at=now,
        )
        session.add(row)
    else:
        row.mood = payload.mood
        row.checked_at = now

    await presence.touch(session, user.id)
    await session.flush()
    return MoodCheckOut.model_validate(row)
