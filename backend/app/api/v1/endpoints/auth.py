"""휴대폰 인증 · 토큰.

MVP 는 SMS 공급사 계약 전이라 코드를 Redis 에만 저장한다.
dev 환경에서는 응답에 코드를 돌려주어 앱 없이도 개발할 수 있게 한다.
운영 전환 시 send_sms 만 실제 공급사로 교체하면 된다 — 계획서 14장 2번.
"""

import secrets
from datetime import UTC, datetime

import jwt
from fastapi import APIRouter
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.core.errors import Unauthorized
from app.core.redis import redis
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.models.user import Family, FamilyMember, User, UserSettings
from app.schemas.auth import (
    MeOut,
    OTPRequest,
    OTPRequestResult,
    OTPVerify,
    RefreshRequest,
    TokenPair,
    UserOut,
)

router = APIRouter(tags=["auth"])

OTP_TTL_SECONDS = 180
OTP_KEY = "otp:{phone}"


@router.post("/auth/otp/request", response_model=OTPRequestResult)
async def request_otp(payload: OTPRequest) -> OTPRequestResult:
    code = f"{secrets.randbelow(1_000_000):06d}"
    await redis.setex(OTP_KEY.format(phone=payload.phone), OTP_TTL_SECONDS, code)

    # TODO(M3): SMS 공급사 연동. 지금은 발송하지 않는다.
    return OTPRequestResult(sent=True, dev_code=None if settings.is_prod else code)


@router.post("/auth/otp/verify", response_model=TokenPair)
async def verify_otp(payload: OTPVerify, session: DBSession) -> TokenPair:
    key = OTP_KEY.format(phone=payload.phone)
    saved = await redis.get(key)
    if saved is None or saved != payload.code:
        raise Unauthorized("INVALID_OTP", "인증번호가 맞지 않습니다. 다시 입력해 주세요.")
    await redis.delete(key)

    user = await session.scalar(select(User).where(User.phone == payload.phone))
    is_new = user is None

    if is_new:
        if not payload.name or payload.role is None:
            raise Unauthorized("SIGNUP_REQUIRED", "이름과 역할이 필요합니다.")
        user = User(
            phone=payload.phone,
            name=payload.name,
            role=payload.role,
            birth_year=payload.birth_year,
            # 인증번호 확인 = 민감정보 수집·이용 동의 시점 (계획서 11장)
            consented_at=datetime.now(UTC),
        )
        session.add(user)
        await session.flush()
        session.add(UserSettings(user_id=user.id))
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
