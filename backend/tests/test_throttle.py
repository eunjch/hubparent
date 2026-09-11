"""로그인 시도 제한 — 2026-09-11 점검에서 추가.

어르신 로그인이 이름+전화번호만으로 통과하므로, 자동으로 훑는 것을 막아야 한다.
Redis 가 죽어 있을 때 로그인을 막지 않는 것도 함께 고정한다.
"""

import pytest

from app.core import throttle
from app.core.throttle import TooManyAttempts


class FakeRedis:
    """만료는 무시하고 세기만 한다. 한 창(window) 안의 동작을 보는 테스트다."""

    def __init__(self, broken: bool = False) -> None:
        self.counts: dict[str, int] = {}
        self.broken = broken

    async def incr(self, key: str) -> int:
        if self.broken:
            raise ConnectionError("redis 없음")
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    async def expire(self, key: str, seconds: int) -> None:
        if self.broken:
            raise ConnectionError("redis 없음")

    async def ttl(self, key: str) -> int:
        return 300

    async def delete(self, key: str) -> None:
        self.counts.pop(key, None)


@pytest.fixture(autouse=True)
def _reset_breaker(monkeypatch):
    monkeypatch.setattr(throttle, "_down_until", 0.0)


@pytest.mark.asyncio
async def test_blocks_after_the_limit(monkeypatch):
    monkeypatch.setattr(throttle, "redis", FakeRedis())

    for _ in range(3):
        await throttle.guard("login", "a@b.com", limit=3, window=600)

    with pytest.raises(TooManyAttempts) as exc:
        await throttle.guard("login", "a@b.com", limit=3, window=600)
    assert exc.value.code == "TOO_MANY_ATTEMPTS"
    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_success_clears_the_counter(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(throttle, "redis", fake)

    await throttle.guard("login", "a@b.com", limit=2, window=600)
    await throttle.clear("login", "a@b.com")
    # 지웠으므로 처음부터 다시 셀 수 있다
    await throttle.guard("login", "a@b.com", limit=2, window=600)
    await throttle.guard("login", "a@b.com", limit=2, window=600)


@pytest.mark.asyncio
async def test_keys_do_not_collide(monkeypatch):
    monkeypatch.setattr(throttle, "redis", FakeRedis())
    await throttle.guard("login", "a@b.com", limit=1, window=600)
    await throttle.guard("login", "다른@b.com", limit=1, window=600)
    await throttle.guard("senior", "a@b.com", limit=1, window=600)


@pytest.mark.asyncio
async def test_redis_failure_does_not_block_login(monkeypatch):
    """보조 장치 때문에 로그인 전체가 멈추면 안 된다."""
    monkeypatch.setattr(throttle, "redis", FakeRedis(broken=True))
    for _ in range(50):
        await throttle.guard("login", "a@b.com", limit=1, window=600)
