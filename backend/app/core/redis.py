"""Redis 연결. OTP 코드처럼 만료가 있는 임시 값에만 쓴다."""

from redis.asyncio import Redis, from_url

from app.core.config import settings

redis: Redis = from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
