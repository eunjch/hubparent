"""JWT 발급 · 검증."""

import re
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import settings

ALGORITHM = "HS256"


def _encode(subject: uuid.UUID, token_type: str, expires: timedelta, epoch: int = 0) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "typ": token_type,
        "gen": epoch,
        "iat": int(now.timestamp()),
        "exp": int((now + expires).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(user_id: uuid.UUID, epoch: int = 0) -> str:
    return _encode(user_id, "access", timedelta(minutes=settings.ACCESS_TOKEN_MINUTES), epoch)


def create_refresh_token(user_id: uuid.UUID, epoch: int = 0) -> str:
    return _encode(user_id, "refresh", timedelta(days=settings.REFRESH_TOKEN_DAYS), epoch)


def read_token(token: str, expected_type: str = "access") -> tuple[uuid.UUID, int]:
    """유효하면 (user_id, 세대) 를 돌려준다. 아니면 jwt 예외를 그대로 올린다.

    세대(gen)는 비밀번호를 바꿀 때 올린다. 옛 토큰은 세대가 낮아 거절된다 —
    비밀번호를 바꿔도 공격자의 refresh 토큰이 180일 살아 있던 것을 막는다
    (2026-09-11 재점검). 세대가 없는 옛 토큰은 0 으로 본다.
    """
    payload = jwt.decode(
        token, settings.SECRET_KEY, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]}
    )
    if payload.get("typ") != expected_type:
        raise jwt.InvalidTokenError(f"expected {expected_type} token")
    return uuid.UUID(payload["sub"]), int(payload.get("gen", 0))


def decode_token(token: str, expected_type: str = "access") -> uuid.UUID:
    """세대를 보지 않는 옛 진입점. 새 코드는 read_token 을 쓴다."""
    return read_token(token, expected_type)[0]


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
    """저장·조회 모두 숫자만 남긴 국내 형태(010…)로 맞춘다.

    부모 로그인이 자녀 전화번호로 계정을 찾으므로, 하이픈이나 국가번호 때문에
    못 찾는 일이 없어야 한다. 자녀가 010-1111-2222 로 가입하고 부모님이
    +82 10-1111-2222 를 넣으면 서로 다른 값이 되던 것을 막는다 (2026-09-11 점검).
    """
    digits = "".join(ch for ch in value if ch.isdigit())
    if digits.startswith("82"):
        digits = "0" + digits[2:]
    return digits


PHONE_RE = re.compile(r"^01[016789]\d{7,8}$")


def valid_phone(value: str) -> bool:
    """정규화한 뒤 국내 휴대전화 형태인가. '----------' 같은 값이 들어오던 것을 막는다."""
    return bool(PHONE_RE.match(normalize_phone(value)))
