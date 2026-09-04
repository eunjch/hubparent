"""가입 · 로그인 흐름 — 계획서 1.4.

자녀는 일반 회원가입(이메일 + 비밀번호),
어르신은 자녀 이름 + 자녀 번호로 가족을 찾아 목록에서 본인을 고른다.
어르신 쪽 입력이 최소라는 것이 이 설계의 핵심이라 그 계약을 테스트로 고정한다.
"""

import pytest

GUARDIAN = {
    "email": "minsu@example.com",
    "password": "hubfamily1234",
    "name": "김민수",
    "phone": "010-1111-2222",
    "agree_health_data": True,
    "agree_email_report": True,
}


async def _register(client, **over):
    body = {**GUARDIAN, **over}
    res = await client.post("/api/v1/auth/register", json=body)
    assert res.status_code == 200, res.text
    return res.json()


async def _add_senior(client, token, name="김영희", phone="010-3333-4444", relation="어머니"):
    res = await client.post(
        "/api/v1/family/seniors",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": name, "phone": phone, "relation": relation},
    )
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.asyncio
async def test_register_requires_health_consent(client):
    res = await client.post(
        "/api/v1/auth/register", json={**GUARDIAN, "agree_health_data": False}
    )
    assert res.status_code == 409
    assert res.json()["code"] == "CONSENT_REQUIRED"


@pytest.mark.asyncio
async def test_register_then_login(client):
    reg = await _register(client)
    assert reg["is_new_user"] is True

    ok = await client.post(
        "/api/v1/auth/login", json={"email": GUARDIAN["email"], "password": GUARDIAN["password"]}
    )
    assert ok.status_code == 200

    bad = await client.post(
        "/api/v1/auth/login", json={"email": GUARDIAN["email"], "password": "wrongpassword"}
    )
    assert bad.status_code == 401
    assert bad.json()["code"] == "BAD_CREDENTIALS"


@pytest.mark.asyncio
async def test_duplicate_email_is_rejected(client):
    await _register(client)
    res = await client.post("/api/v1/auth/register", json={**GUARDIAN, "phone": "010-9999-0000"})
    assert res.status_code == 409
    assert res.json()["code"] == "EMAIL_TAKEN"


@pytest.mark.asyncio
async def test_guardian_manages_multiple_seniors(client):
    """자녀 1명 : 부모 N명."""
    token = (await _register(client))["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    await _add_senior(client, token, name="김영희", phone="010-3333-4444", relation="어머니")
    await _add_senior(client, token, name="김철수", phone="010-5555-6666", relation="아버지")

    res = await client.get("/api/v1/family/seniors", headers=auth)
    assert res.status_code == 200
    seniors = res.json()
    assert [s["name"] for s in seniors] == ["김영희", "김철수"]
    # 아직 한 번도 안 들어왔다
    assert all(s["joined"] is False for s in seniors)


@pytest.mark.asyncio
async def test_senior_logs_in_with_guardian_name_and_phone(client):
    token = (await _register(client))["access_token"]
    await _add_senior(client, token, name="김영희")
    await _add_senior(client, token, name="김철수", phone="010-5555-6666", relation="아버지")

    # 1단계 — 하이픈이 있든 없든 찾아야 한다
    lookup = await client.post(
        "/api/v1/auth/senior/lookup",
        json={"guardian_name": "김민수", "guardian_phone": "01011112222"},
    )
    assert lookup.status_code == 200, lookup.text
    body = lookup.json()
    assert {s["name"] for s in body["seniors"]} == {"김영희", "김철수"}

    # 2단계 — 본인 선택
    target = next(s for s in body["seniors"] if s["name"] == "김영희")
    login = await client.post(
        "/api/v1/auth/senior/login",
        json={
            "guardian_name": "김민수",
            "guardian_phone": "010-1111-2222",
            "senior_id": target["id"],
        },
    )
    assert login.status_code == 200, login.text

    me = await client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"}
    )
    assert me.json()["user"]["name"] == "김영희"
    assert me.json()["user"]["role"] == "senior"
    # 첫 로그인 시점에 본인 동의가 성립한다
    assert me.json()["consented"] is True


@pytest.mark.asyncio
async def test_wrong_guardian_info_is_rejected(client):
    token = (await _register(client))["access_token"]
    await _add_senior(client, token)

    res = await client.post(
        "/api/v1/auth/senior/lookup",
        json={"guardian_name": "다른사람", "guardian_phone": "010-1111-2222"},
    )
    assert res.status_code == 404
    assert res.json()["code"] == "GUARDIAN_NOT_FOUND"


@pytest.mark.asyncio
async def test_senior_id_alone_cannot_log_in(client):
    """다른 가족의 senior_id 를 알아도 자녀 정보가 맞지 않으면 못 들어온다."""
    t1 = (await _register(client))["access_token"]
    victim = await _add_senior(client, t1)

    t2 = (await _register(client, email="other@example.com", phone="010-7777-8888", name="남남"))[
        "access_token"
    ]
    await _add_senior(client, t2, name="남의부모", phone="010-2222-1111")

    res = await client.post(
        "/api/v1/auth/senior/login",
        json={
            "guardian_name": "남남",
            "guardian_phone": "010-7777-8888",
            "senior_id": victim["id"],
        },
    )
    assert res.status_code == 404
    assert res.json()["code"] == "SENIOR_NOT_FOUND"


@pytest.mark.asyncio
async def test_senior_already_in_another_family(client):
    t1 = (await _register(client))["access_token"]
    await _add_senior(client, t1, phone="010-3333-4444")

    t2 = (await _register(client, email="other@example.com", phone="010-7777-8888", name="남남"))[
        "access_token"
    ]
    res = await client.post(
        "/api/v1/family/seniors",
        headers={"Authorization": f"Bearer {t2}"},
        json={"name": "김영희", "phone": "010-3333-4444"},
    )
    assert res.status_code == 409
    assert res.json()["code"] == "SENIOR_ALREADY_JOINED"
