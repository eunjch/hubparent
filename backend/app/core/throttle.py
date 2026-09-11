"""시도 제한 — 2026-09-11 점검에서 도입, 재점검에서 다시 손봄.

어르신 로그인은 자녀 이름 + 전화번호만으로 토큰이 나온다. 설계상 한계라 문서에 적어 두었지만
완화 장치가 하나도 없었다.

재점검에서 드러난 두 가지를 함께 고쳤다.

1. **버킷이 공격 대상이면 잠금이 공격 수단이 된다.** 남의 이메일만 알면 10분마다 열 번씩
   던져 그 자녀 계정을 영구히 잠글 수 있었다. 자녀 계정은 가족 전체의 유일한 뿌리다.
   그래서 **누가 두드리는가(IP)** 를 함께 센다. 계정 버킷은 훨씬 느슨하게 두어,
   같은 계정을 오래 두드리는 것만 늦춘다.
2. **INCR 과 EXPIRE 가 따로면 TTL 없는 키가 생긴다.** 그러면 카운터가 영원히 남아
   "10분 뒤에 다시" 를 무한 반복한다. 한 번의 왕복으로 묶는다.

Redis 가 없거나 죽어 있으면 **막지 않고 통과시킨다.** 인증 보조 장치 때문에 로그인 전체가
멈추면 안 된다.
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

# INCR 하고 없으면 TTL 을 건다. 두 번 왕복하면 그 사이에 끊겨 TTL 없는 키가 남는다.
_INCR_WITH_TTL = """
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {n, ttl}
"""


class TooManyAttempts(AppError):
    def __init__(self, seconds: int) -> None:
        minutes = max(1, round(seconds / 60))
        super().__init__(
            429,
            "TOO_MANY_ATTEMPTS",
            f"시도가 너무 많습니다. {minutes}분 뒤에 다시 해 주세요.",
        )


async def _bump(bucket: str, window: int) -> tuple[int, int]:
    """(횟수, 남은 초). Redis 를 못 쓰면 (0, 0)."""
    global _down_until
    if time.monotonic() < _down_until:
        return 0, 0
    try:
        count, ttl = await redis.eval(_INCR_WITH_TTL, 1, bucket, window)
        return int(count), int(ttl)
    except Exception as exc:  # noqa: BLE001 — Redis 장애로 로그인을 막지 않는다
        _down_until = time.monotonic() + _DOWN_FOR_SECONDS
        log.warning("시도 제한을 확인하지 못했습니다: %s", exc)
        return 0, 0


async def guard(
    scope: str,
    key: str,
    *,
    limit: int,
    window: int,
    source: str | None = None,
    source_limit: int | None = None,
) -> None:
    """window 초 안에 limit 번까지 허용한다. 넘으면 예외.

    source(대개 접속 IP)를 함께 주면 그쪽도 센다. 계정 쪽은 느슨하게, 출처 쪽은 촘촘하게
    잡아야 잠금이 공격 수단이 되지 않는다.
    """
    if source:
        count, ttl = await _bump(f"throttle:{scope}:from:{source}", window)
        if count and count > (source_limit or limit):
            raise TooManyAttempts(ttl or window)

    if key:
        count, ttl = await _bump(f"throttle:{scope}:{key}", window)
        if count and count > limit:
            raise TooManyAttempts(ttl or window)


async def clear(scope: str, key: str) -> None:
    """성공했으면 계정 카운터를 지운다 — 정상 사용자가 다음에 걸리지 않도록."""
    if time.monotonic() < _down_until:
        return
    with contextlib.suppress(Exception):
        await redis.delete(f"throttle:{scope}:{key}")
