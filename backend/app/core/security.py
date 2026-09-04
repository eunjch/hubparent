"""JWT 발급 · 검증."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import settings

ALGORITHM = "HS256"


def _encode(subject: uuid.UUID, token_type: str, expires: timedelta) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "typ": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(user_id: uuid.UUID) -> str:
    return _encode(user_id, "access", timedelta(minutes=settings.ACCESS_TOKEN_MINUTES))


def create_refresh_token(user_id: uuid.UUID) -> str:
    return _encode(user_id, "refresh", timedelta(days=settings.REFRESH_TOKEN_DAYS))


def decode_token(token: str, expected_type: str = "access") -> uuid.UUID:
    """유효하면 user_id 를 돌려준다. 아니면 jwt 예외를 그대로 올린다."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    if payload.get("typ") != expected_type:
        raise jwt.InvalidTokenError(f"expected {expected_type} token")
    return uuid.UUID(payload["sub"])


# ── 비밀번호 ────────────────────────────────────────────────
# 자녀 계정만 비밀번호를 갖는다. 어르신은 자녀 이름·번호로 들어온다 (계획서 1.4).

_hasher = PasswordHasher()


def hash_password(raw: str) -> str:
    return _hasher.hash(raw)


def verify_password(raw: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        _hasher.verify(hashed, raw)
    except (VerifyMismatchError, InvalidHashError):
        return False
    return True


def normalize_phone(value: str) -> str:
    """저장·조회 모두 숫자만 남긴 형태로 맞춘다.

    부모 로그인이 자녀 전화번호로 계정을 찾으므로, 하이픈 유무 때문에
    못 찾는 일이 없어야 한다.
    """
    return "".join(ch for ch in value if ch.isdigit())
