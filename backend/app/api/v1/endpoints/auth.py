"""계정 · 토큰.

MVP 는 본인인증이 없다 (계획서 1.4). 실사용자를 받기 전에 반드시 교체하며,
교체 지점을 좁히기 위해 계정 진입을 POST /auth/start 하나로 모아 둔다.
"""

from datetime import UTC, datetime

import jwt
from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.core.errors import Conflict, Unauthorized
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.models.enums import ConsentKind
from app.models.user import Family, FamilyMember, User, UserConsent, UserSettings
from app.schemas.auth import AuthStart, MeOut, RefreshRequest, TokenPair, UserOut

router = APIRouter(tags=["auth"])


def record_consent(session: DBSession, user_id, kind: ConsentKind, granted: bool) -> None:
    """동의는 이력으로 남긴다. 철회 시점이 남아야 한다 — 계획서 12.1."""
    if granted:
        session.add(UserConsent(user_id=user_id, kind=kind, granted_at=datetime.now(UTC)))


@router.post("/auth/start", response_model=TokenPair)
async def start(payload: AuthStart, session: DBSession) -> TokenPair:
    """계정을 만들거나, 이미 있으면 그 계정으로 토큰을 발급한다."""
    if not payload.agree_health_data:
        raise Conflict("CONSENT_REQUIRED", "건강정보 이용 동의가 필요합니다.")

    user = await session.scalar(select(User).where(User.phone == payload.phone))
    is_new = user is None

    if is_new:
        user = User(
            phone=payload.phone,
            name=payload.name,
            email=payload.email,
            role=payload.role,
            birth_year=payload.birth_year,
            consented_at=datetime.now(UTC),
        )
        session.add(user)
        await session.flush()

        session.add(UserSettings(user_id=user.id))
        record_consent(session, user.id, ConsentKind.HEALTH_DATA, True)
        record_consent(session, user.id, ConsentKind.EMAIL_REPORT, payload.agree_email_report)
        await session.flush()
    else:
        # 재접속. 이메일만 새로 들어왔으면 채운다.
        if payload.email and not user.email:
            user.email = payload.email
            await session.flush()

    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        is_new_user=is_new,
    )


@router.post("/auth/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, session: DBSession) -> TokenPair:
    try:
        user_id = decode_token(payload.refresh_token, expected_type="refresh")
    except jwt.InvalidTokenError as exc:
        raise Unauthorized("INVALID_TOKEN", "다시 시작해 주세요.") from exc

    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise Unauthorized("USER_NOT_FOUND", "다시 시작해 주세요.")

    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=MeOut)
async def me(user: CurrentUser, session: DBSession) -> MeOut:
    row = (
        await session.execute(
            select(Family.id, Family.name)
            .join(FamilyMember, FamilyMember.family_id == Family.id)
            .where(FamilyMember.user_id == user.id)
            .limit(1)
        )
    ).first()

    return MeOut(
        user=UserOut.model_validate(user),
        family_id=row[0] if row else None,
        family_name=row[1] if row else None,
        consented=user.consented_at is not None,
    )
