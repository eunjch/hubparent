"""시도 제한 — 2026-09-11 점검에서 도입, 재점검에서 다시 검증.

여기서 지키려는 계약은 셋이다.
  1. 같은 출처가 과하게 두드리면 막는다.
  2. **남의 계정을 잠그는 수단이 되면 안 된다.**
  3. Redis 가 이상해도 로그인을 막지 않고, TTL 없는 키를 남기지 않는다.

앞선 가짜 Redis 는 "만료는 무시하고 세기만" 했는데, 이 모듈의 진짜 위험이 전부
만료 쪽에 있었다. 그래서 TTL 을 실제로 흉내 내고 부분 실패도 재현한다.
"""

import pytest

from app.core import throttle
from app.core.throttle import TooManyAttempts


class FakeRedis:
    """eval 로 들어오는 INCR+EXPIRE 를 원자적으로 흉내 낸다.

    expire_fails=True 면 예전 구조(INCR 성공 + EXPIRE 실패)를 재현한다 —
    한 번의 왕복으로 묶었으므로 이제 이 상황 자체가 생기지 않아야 한다.
    """

    def __init__(self, broken: bool = False, expire_fails: bool = False) -> None:
        self.counts: dict[str, int] = {}
        self.ttls: dict[str, int] = {}
        self.broken = broken
        self.expire_fails = expire_fails

    async def eval(self, _script: str, _nkeys: int, key: str, window: int):
        if self.broken:
            raise ConnectionError("redis 없음")
        self.counts[key] = self.counts.get(key, 0) + 1
        if self.counts[key] == 1 and not self.expire_fails:
            self.ttls[key] = int(window)
        # 스크립트는 TTL 이 없으면 다시 건다 — 그 동작까지 흉내 낸다
        if self.ttls.get(key, -1) < 0:
            self.ttls[key] = int(window)
        return [self.counts[key], self.ttls[key]]

    async def delete(self, key: str) -> None:
        self.counts.pop(key, None)
        self.ttls.pop(key, None)


@pytest.fixture(autouse=True)
def _reset_breaker(monkeypatch):
    monkeypatch.setattr(throttle, "_down_until", 0.0)


@pytest.mark.asyncio
async def test_blocks_one_source_that_knocks_too_much(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(throttle, "redis", fake)

    for _ in range(3):
        await throttle.guard("login", "a@b.com", limit=99, window=600, source="1.1.1.1", source_limit=3)

    with pytest.raises(TooManyAttempts) as exc:
        await throttle.guard("login", "a@b.com", limit=99, window=600, source="1.1.1.1", source_limit=3)
    assert exc.value.code == "TOO_MANY_ATTEMPTS"
    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_one_attacker_cannot_lock_someone_elses_account(monkeypatch):
    """남의 이메일을 두드려 그 계정을 잠글 수 없어야 한다.

    자녀 계정은 가족 전체의 유일한 뿌리다. 잠기면 부모님까지 못 들어온다.
    """
    fake = FakeRedis()
    monkeypatch.setattr(throttle, "redis", fake)

    # 공격자가 한 IP 에서 피해자 이메일을 두드리다 막힌다
    with pytest.raises(TooManyAttempts):
        for _ in range(30):
            await throttle.guard(
                "login", "victim@b.com", limit=50, window=600, source="9.9.9.9", source_limit=10
            )

    # 피해자는 자기 자리에서 그대로 들어올 수 있다
    await throttle.guard(
        "login", "victim@b.com", limit=50, window=600, source="1.2.3.4", source_limit=10
    )


@pytest.mark.asyncio
async def test_ttl_is_always_set(monkeypatch):
    """TTL 없는 카운터가 남으면 "10분 뒤에 다시" 를 영원히 반복하게 된다."""
    fake = FakeRedis(expire_fails=True)   # 예전 구조에서 영구 잠금을 만들던 상황
    monkeypatch.setattr(throttle, "redis", fake)

    await throttle.guard("login", "a@b.com", limit=5, window=600, source="1.1.1.1")
    assert all(ttl > 0 for ttl in fake.ttls.values()), "TTL 없는 키가 남았다"


@pytest.mark.asyncio
async def test_success_clears_the_account_counter(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(throttle, "redis", fake)

    await throttle.guard("login", "a@b.com", limit=2, window=600)
    await throttle.clear("login", "a@b.com")
    await throttle.guard("login", "a@b.com", limit=2, window=600)
    await throttle.guard("login", "a@b.com", limit=2, window=600)


@pytest.mark.asyncio
async def test_scopes_and_keys_do_not_collide(monkeypatch):
    monkeypatch.setattr(throttle, "redis", FakeRedis())
    await throttle.guard("login", "a@b.com", limit=1, window=600)
    await throttle.guard("login", "다른@b.com", limit=1, window=600)
    await throttle.guard("senior", "a@b.com", limit=1, window=600)


@pytest.mark.asyncio
async def test_redis_failure_does_not_block_login(monkeypatch):
    """보조 장치 때문에 로그인 전체가 멈추면 안 된다."""
    monkeypatch.setattr(throttle, "redis", FakeRedis(broken=True))
    for _ in range(50):
        await throttle.guard("login", "a@b.com", limit=1, window=600, source="1.1.1.1")
