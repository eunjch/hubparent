"""온보딩 흐름 — 계획서 1.4.

자녀가 가족과 부모님 계정을 만들고, 어르신은 코드만 입력해 들어온다.
어르신 쪽 입력이 0이라는 것이 이 설계의 핵심이라, 그 계약을 테스트로 고정한다.
"""

import pytest


async def _guardian(client, phone="01011112222"):
    res = await client.post(
        "/api/v1/auth/start",
        json={
            "phone": phone,
            "name": "김민수",
            "role": "guardian",
            "email": "minsu@example.com",
            "agree_health_data": True,
            "agree_email_report": True,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


async def _family(client, token, senior_phone="01033334444"):
    res = await client.post(
        "/api/v1/families",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "김영희 가족",
            "senior_name": "김영희",
            "senior_phone": senior_phone,
            "relation": "어머니",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.asyncio
async def test_health_consent_is_required(client):
    res = await client.post(
        "/api/v1/auth/start",
        json={"phone": "01099998888", "name": "동의안함", "role": "guardian"},
    )
    assert res.status_code == 409
    assert res.json()["code"] == "CONSENT_REQUIRED"


@pytest.mark.asyncio
async def test_guardian_creates_family_and_gets_code(client):
    g = await _guardian(client)
    assert g["is_new_user"] is True

    created = await _family(client, g["access_token"])
    assert len(created["invitation_code"]) == 6
    # 혼동되는 글자는 코드에 쓰지 않는다
    assert not set(created["invitation_code"]) & set("01OI")


@pytest.mark.asyncio
async def test_senior_joins_with_code_only(client):
    g = await _guardian(client)
    created = await _family(client, g["access_token"])
    code = created["invitation_code"]

    # 어르신은 로그인 전에 "김영희 님 맞으세요?" 를 본다
    preview = await client.get(f"/api/v1/invitations/{code}")
    assert preview.status_code == 200
    body = preview.json()
    assert body["target_name"] == "김영희"
    assert body["expired"] is False and body["used"] is False

    # 코드만으로 토큰을 받는다 — 인증 헤더 없음
    claim = await client.post(f"/api/v1/invitations/{code}/claim")
    assert claim.status_code == 200, claim.text
    senior_token = claim.json()["access_token"]

    me = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {senior_token}"})
    assert me.status_code == 200
    assert me.json()["user"]["name"] == "김영희"
    assert me.json()["user"]["role"] == "senior"
    # 합류 시점에 어르신 본인 동의가 성립한다
    assert me.json()["consented"] is True


@pytest.mark.asyncio
async def test_code_is_single_use(client):
    g = await _guardian(client)
    code = (await _family(client, g["access_token"]))["invitation_code"]

    assert (await client.post(f"/api/v1/invitations/{code}/claim")).status_code == 200
    second = await client.post(f"/api/v1/invitations/{code}/claim")
    assert second.status_code == 409
    assert second.json()["code"] == "INVITE_USED"


@pytest.mark.asyncio
async def test_unknown_code_is_rejected(client):
    res = await client.post("/api/v1/invitations/ZZZZZZ/claim")
    assert res.status_code == 404
    assert res.json()["code"] == "INVITE_NOT_FOUND"


@pytest.mark.asyncio
async def test_senior_cannot_be_in_two_families(client):
    g1 = await _guardian(client, phone="01011110001")
    await _family(client, g1["access_token"], senior_phone="01055556666")

    g2 = await _guardian(client, phone="01011110002")
    res = await client.post(
        "/api/v1/families",
        headers={"Authorization": f"Bearer {g2['access_token']}"},
        json={
            "name": "다른 가족",
            "senior_name": "김영희",
            "senior_phone": "01055556666",
            "relation": "아들",
        },
    )
    assert res.status_code == 409
    assert res.json()["code"] == "SENIOR_ALREADY_JOINED"
