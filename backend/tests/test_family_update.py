"""부모님 정보 수정 — 이름·관계·번호·출생연도 (화면 G 부모님 관리)."""

import pytest

from tests.test_onboarding import _add_senior, _register


@pytest.mark.asyncio
async def test_update_senior_fields(client):
    g = await _register(client)
    h = {"Authorization": f"Bearer {g['access_token']}"}
    senior = await _add_senior(client, g["access_token"])

    res = await client.patch(
        f"/api/v1/family/seniors/{senior['id']}",
        headers=h,
        json={"name": "김영자", "relation": "어머니", "phone": "010-2222-3333", "birth_year": 1950},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "김영자"
    assert body["relation"] == "어머니"
    assert body["phone"] == "01022223333"
    assert body["birth_year"] == 1950

    # 목록에도 반영된다
    rows = (await client.get("/api/v1/family/seniors", headers=h)).json()
    assert rows[0]["phone"] == "01022223333"


@pytest.mark.asyncio
async def test_update_senior_phone_conflict(client):
    g = await _register(client)
    h = {"Authorization": f"Bearer {g['access_token']}"}
    senior = await _add_senior(client, g["access_token"])

    # 자녀 본인 번호로는 못 바꾼다
    me = (await client.get("/api/v1/me", headers=h)).json()
    res = await client.patch(
        f"/api/v1/family/seniors/{senior['id']}", headers=h, json={"phone": me["user"]["phone"]}
    )
    assert res.status_code == 409
    assert res.json()["code"] == "PHONE_TAKEN"

    # 같은 번호 그대로는 괜찮다
    res = await client.patch(
        f"/api/v1/family/seniors/{senior['id']}", headers=h, json={"phone": senior["phone"]}
    )
    assert res.status_code == 200
