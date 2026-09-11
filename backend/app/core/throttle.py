"""로그인 시도 제한 — 2026-09-11 점검.

어르신 로그인은 자녀 이름 + 전화번호만으로 토큰이 나온다. 설계상 한계라 문서에 적어 두었지만
완화 장치가 하나도 없어, 이름을 아는 사람이 번호 8자리를 자동으로 훑으면 뚫린다.
자녀 비밀번호 로그인도 마찬가지로 무제한이었다.

Redis 컨테이너는 이미 떠 있는데 코드에서 쓰이지 않고 있었다 — 여기서 쓴다.
Redis 가 없거나 죽어 있으면 **막지 않고 통과시킨다.** 인증 보조 장치 때문에 로그인
전체가 멈추면 안 된다. 그 경우는 경고 로그로만 남긴다.
"""

import contextlib
import logging
import time

from app.core.errors import AppError
from app.core.redis import redis

log = logging.getLogger("hubfamily.throttle")

# Redis 가 죽어 있으면 매 요청마다 연결을 기다리게 된다. 한 번 실패하면 잠시 쉬었다 다시 본다.
_DOWN_FOR_SECONDS = 30
_down_until = 0.0


class TooManyAttempts(AppError):
    def __init__(self, seconds: int) -> None:
        minutes = max(1, round(seconds / 60))
        super().__init__(
            429,
            "TOO_MANY_ATTEMPTS",
            f"시도가 너무 많습니다. {minutes}분 뒤에 다시 해 주세요.",
        )


async def guard(scope: str, key: str, *, limit: int, window: int) -> None:
    """window 초 동안 limit 번까지만 허용한다. 넘으면 예외."""
    global _down_until
    if not key or time.monotonic() < _down_until:
        return
    bucket = f"throttle:{scope}:{key}"
    try:
        count = await redis.incr(bucket)
        if count == 1:
            await redis.expire(bucket, window)
        if count > limit:
            ttl = await redis.ttl(bucket)
            raise TooManyAttempts(ttl if ttl and ttl > 0 else window)
    except TooManyAttempts:
        raise
    except Exception as exc:  # noqa: BLE001 — Redis 장애로 로그인을 막지 않는다
        _down_until = time.monotonic() + _DOWN_FOR_SECONDS
        log.warning("시도 제한을 확인하지 못했습니다 (%s): %s", scope, exc)


async def clear(scope: str, key: str) -> None:
    """성공했으면 카운터를 지운다 — 정상 사용자가 다음에 걸리지 않도록."""
    if time.monotonic() < _down_until:
        return
    with contextlib.suppress(Exception):
        await redis.delete(f"throttle:{scope}:{key}")
