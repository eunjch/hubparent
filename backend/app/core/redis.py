"""Redis 연결. 만료가 있는 임시 값에만 쓴다 (지금은 로그인 시도 제한).

짧은 타임아웃을 둔다. Redis 는 보조 장치라, 죽어 있을 때 로그인 요청이 그만큼
매달리면 본말이 전도된다 — 빠르게 포기하고 통과시킨다 (core/throttle.py).
"""

from redis.asyncio import Redis, from_url

from app.core.config import settings

redis: Redis = from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
    socket_connect_timeout=0.3,
    socket_timeout=0.3,
    retry_on_timeout=False,
)
