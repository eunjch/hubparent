"""비밀번호 재설정 — 2026-09-11 점검에서 추가.

자녀가 비밀번호를 잊으면 자녀도 부모님도 들어갈 수 없었다. 그 복구 경로다.
"""

import pytest

from tests.test_onboarding import GUARDIAN, _register


async def _forgot(client, email, monkeypatch):
    """메일 발송은 가로채고, 만들어진 링크의 토큰만 돌려준다."""
    from app.api.v1.endpoints import auth as auth_ep

    sent: list[tuple] = []
    monkeypatch.setattr(auth_ep.mailer, "send", lambda *a, **k: sent.append(a))

    res = await client.post("/api/v1/auth/password/forgot", json={"email": email})
    assert res.status_code == 200, res.text
    assert res.json() == {"ok": True}
    if not sent:
        return None
    body = sent[0][2]  # (to, subject, html, text)
    return body.split("token=")[1].split('"')[0]


@pytest.mark.asyncio
async def test_reset_lets_the_guardian_back_in(client, monkeypatch):
    await _register(client)
    token = await _forgot(client, GUARDIAN["email"], monkeypatch)
    assert token

    res = await client.post(
        "/api/v1/auth/password/reset", json={"token": token, "password": "새비밀번호1234"}
    )
    assert res.status_code == 200, res.text

    # 옛 비밀번호는 막히고 새 비밀번호로 들어간다
    old = await client.post(
        "/api/v1/auth/login", json={"email": GUARDIAN["email"], "password": GUARDIAN["password"]}
    )
    assert old.status_code == 401
    new = await client.post(
        "/api/v1/auth/login", json={"email": GUARDIAN["email"], "password": "새비밀번호1234"}
    )
    assert new.status_code == 200, new.text


@pytest.mark.asyncio
async def test_link_works_only_once(client, monkeypatch):
    """한 번 쓴 링크는 듣지 않는다 — 메일함이 털려도 두 번은 안 된다."""
    await _register(client)
    token = await _forgot(client, GUARDIAN["email"], monkeypatch)

    first = await client.post(
        "/api/v1/auth/password/reset", json={"token": token, "password": "첫번째비밀1234"}
    )
    assert first.status_code == 200

    again = await client.post(
        "/api/v1/auth/password/reset", json={"token": token, "password": "두번째비밀1234"}
    )
    assert again.status_code == 400
    assert again.json()["code"] == "INVALID_RESET_TOKEN"


@pytest.mark.asyncio
async def test_unknown_email_looks_the_same(client, monkeypatch):
    """가입 여부를 응답으로 알려주지 않는다 — 회원 목록을 훑을 수 없어야 한다."""
    token = await _forgot(client, "없는사람@example.com", monkeypatch)
    assert token is None  # 메일은 안 나갔지만


@pytest.mark.asyncio
async def test_garbage_token_is_rejected(client):
    res = await client.post(
        "/api/v1/auth/password/reset", json={"token": "aaa.bbb.ccc", "password": "아무비밀1234"}
    )
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_RESET_TOKEN"
