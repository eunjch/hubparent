"""FastAPI 의존성.

권한 규칙 (계획서 6장): 보호자는 같은 family 에 속한 어르신 데이터만 볼 수 있다.
모든 조회 라우터가 assert_family_access 를 거치도록 한다.
"""

import uuid
from typing import Annotated

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import Forbidden, Unauthorized
from app.core.security import decode_token
from app.models.enums import UserRole
from app.models.user import FamilyMember, User

bearer = HTTPBearer(auto_error=False)

DBSession = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    session: DBSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)] = None,
) -> User:
    if credentials is None:
        raise Unauthorized("NO_TOKEN", "로그인이 필요합니다.")
    try:
        user_id = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError as exc:
        raise Unauthorized("TOKEN_EXPIRED", "다시 시작해 주세요.") from exc
    except jwt.InvalidTokenError as exc:
        raise Unauthorized("INVALID_TOKEN", "다시 시작해 주세요.") from exc

    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise Unauthorized("USER_NOT_FOUND", "다시 시작해 주세요.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_senior(user: CurrentUser) -> User:
    if user.role is not UserRole.SENIOR:
        raise Forbidden("SENIOR_ONLY", "어르신 계정만 사용할 수 있습니다.")
    return user


async def require_guardian(user: CurrentUser) -> User:
    if user.role is not UserRole.GUARDIAN:
        raise Forbidden("GUARDIAN_ONLY", "보호자 계정만 사용할 수 있습니다.")
    return user


async def shared_family_ids(session: AsyncSession, user_id: uuid.UUID) -> list[uuid.UUID]:
    rows = await session.scalars(select(FamilyMember.family_id).where(FamilyMember.user_id == user_id))
    return list(rows)


async def assert_family_access(session: AsyncSession, actor: User, target_user_id: uuid.UUID) -> None:
    """actor 가 target_user 의 데이터를 볼 수 있는지 검증한다."""
    if actor.id == target_user_id:
        return

    actor_families = await shared_family_ids(session, actor.id)
    if not actor_families:
        raise Forbidden("NO_FAMILY", "가족으로 연결되어 있지 않습니다.")

    target_families = await shared_family_ids(session, target_user_id)
    if not set(actor_families) & set(target_families):
        raise Forbidden("NOT_SAME_FAMILY", "가족으로 연결되어 있지 않습니다.")


def client_ip(request: Request) -> str | None:
    """아파치 리버스 프록시 뒤에 있으므로 X-Forwarded-For 를 먼저 본다."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
