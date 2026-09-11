"""식사 체크(화면 2) · 기분 체크(화면 4).

(user, date, slot) 유니크 제약 위에서 upsert 로 동작한다.
어르신 단말은 오프라인 큐에 쌓았다가 재전송하므로 같은 요청이 여러 번 올 수 있다.
같은 값이면 그대로, 다른 값이면 마지막 입력으로 덮는다 — 되돌리기 UX 와도 맞는다 (계획서 9장).
"""

import secrets
import uuid
from datetime import UTC, date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession, assert_family_access, require_senior
from app.core.errors import Conflict, NotFound
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


@router.post("/meals", response_model=MealCheckOut, dependencies=[Depends(require_senior)])
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


@router.post("/moods", response_model=MoodCheckOut, dependencies=[Depends(require_senior)])
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


# 식사 사진 (화면 S2 "사진 추가"). 선택 항목이다 — 안 올려도 체크는 끝난다.
PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/heic": ".heic", "image/webp": ".webp"}
PHOTO_MAX_BYTES = 8 * 1024 * 1024


@router.post("/meals/{check_id}/photo", response_model=MealCheckOut)
async def upload_meal_photo(
    check_id: uuid.UUID,
    user: CurrentUser,
    session: DBSession,
    file: UploadFile = File(...),
) -> MealCheckOut:
    """본인 식사 기록에만 올릴 수 있다."""
    row = await session.get(MealCheck, check_id)
    if row is None or row.user_id != user.id:
        raise NotFound("CHECK_NOT_FOUND", "기록을 찾을 수 없습니다.")

    ext = PHOTO_TYPES.get((file.content_type or "").lower())
    if ext is None:
        raise Conflict("UNSUPPORTED_TYPE", "사진 파일만 올릴 수 있습니다.")

    data = await file.read()
    if len(data) > PHOTO_MAX_BYTES:
        raise Conflict("FILE_TOO_LARGE", "사진 용량이 너무 큽니다.")

    # 사용자별 디렉터리에 무작위 이름으로 둔다. 원본 파일명은 쓰지 않는다.
    folder = Path(settings.UPLOAD_DIR) / str(user.id)
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{check_id.hex}_{secrets.token_hex(4)}{ext}"
    (folder / name).write_bytes(data)

    row.photo_path = f"{user.id}/{name}"
    await presence.touch(session, user.id)
    await session.flush()
    return MealCheckOut.model_validate(row)
