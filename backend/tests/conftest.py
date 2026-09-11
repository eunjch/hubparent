"""테스트는 SQLite(aiosqlite) 인메모리로 돈다. DB 컨테이너 없이 CI 에서 실행하기 위함이다.

PostgreSQL 전용 타입(ARRAY)을 쓰는 medications 는 M3 에서 붙으므로,
그 시점에 testcontainers 또는 CI 서비스 컨테이너로 전환한다.
"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import get_session
from app.main import app
from app.models import Base


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine("sqlite+aiosqlite:///:memory:")

    # SQLite 는 외래키를 기본으로 강제하지 않는다. 켜 두지 않으면 services/account.py 의
    # "지우는 순서가 곧 제약 조건" 이라는 안전망이 테스트에서 작동하지 않는다 (2026-09-11 점검).
    @event.listens_for(eng.sync_engine, "connect")
    def _fk_on(dbapi_conn, _record):  # noqa: ANN001
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session(engine) -> AsyncSession:
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        yield s


@pytest_asyncio.fixture
async def client(session) -> AsyncClient:
    async def _override():
        yield session

    app.dependency_overrides[get_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"
