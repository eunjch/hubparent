"""복약 — 자녀가 등록하고 어르신이 응답한다 (계획서 7.3).

권한이 핵심이다. 자녀는 등록만, 어르신은 응답만 한다.
"""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from tests.test_onboarding import _add_senior, _register

KST = ZoneInfo("Asia/Seoul")


async def _family(client):
    """자녀 토큰 · 어르신 토큰 · 어르신 id."""
    g = await _register(client)
    senior = await _add_senior(client, g["access_token"])

    me = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {g['access_token']}"})
    guardian_phone = me.json()["user"]["phone"]

    login = await client.post(
        "/api/v1/auth/senior/login",
        json={
            "guardian_name": "김민수",
            "guardian_phone": guardian_phone,
            "senior_id": senior["id"],
        },
    )
    assert login.status_code == 200, login.text
    return g["access_token"], login.json()["access_token"], senior["id"]


async def _add_med(client, gt, senior_id, **over):
    body = {
        "user_id": senior_id,
        "name": "혈압약",
        "dose": "1정",
        "times": ["08:00", "20:00"],
        **over,
    }
    res = await client.post(
        "/api/v1/medications", headers={"Authorization": f"Bearer {gt}"}, json=body
    )
    assert res.status_code == 200, res.text
    return res.json()


async def _today(client, token, query=""):
    res = await client.get(
        f"/api/v1/medications/today{query}", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.asyncio
async def test_guardian_registers_medication(client):
    gt, _st, senior_id = await _family(client)
    med = await _add_med(client, gt, senior_id)

    assert med["times"] == ["08:00", "20:00"]
    assert med["weekdays"] == [0, 1, 2, 3, 4, 5, 6]
    assert med["is_active"] is True


@pytest.mark.asyncio
async def test_times_are_normalized_and_sorted(client):
    gt, _st, senior_id = await _family(client)
    med = await _add_med(client, gt, senior_id, times=["20:00", "8:5", "08:05"])
    # 중복 제거 + 0 채움 + 정렬
    assert med["times"] == ["08:05", "20:00"]


@pytest.mark.asyncio
async def test_bad_time_is_rejected(client):
    gt, _st, senior_id = await _family(client)
    res = await client.post(
        "/api/v1/medications",
        headers={"Authorization": f"Bearer {gt}"},
        json={"user_id": senior_id, "name": "약", "times": ["25:00"]},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_senior_cannot_register(client):
    _gt, st, senior_id = await _family(client)
    res = await client.post(
        "/api/v1/medications",
        headers={"Authorization": f"Bearer {st}"},
        json={"user_id": senior_id, "name": "약", "times": ["08:00"]},
    )
    assert res.status_code == 403
    assert res.json()["code"] == "GUARDIAN_ONLY"


@pytest.mark.asyncio
async def test_today_expands_schedule(client):
    gt, st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id)

    doses = await _today(client, st)
    assert [d["time"] for d in doses] == ["08:00", "20:00"]
    assert all(d["status"] == "pending" for d in doses)


@pytest.mark.asyncio
async def test_weekday_filter(client):
    gt, st, senior_id = await _family(client)
    today = datetime.now(KST).date()
    other = [d for d in range(7) if d != today.weekday()]
    await _add_med(client, gt, senior_id, weekdays=other)

    assert await _today(client, st) == []


@pytest.mark.asyncio
async def test_answer_and_overwrite(client):
    gt, st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id)

    doses = await _today(client, st)
    target = doses[0]

    first = await client.post(
        f"/api/v1/medications/{target['medication_id']}/logs",
        headers={"Authorization": f"Bearer {st}"},
        json={"scheduled_at": target["scheduled_at"], "status": "taken"},
    )
    assert first.status_code == 200, first.text
    assert first.json()["status"] == "taken"

    # 잘못 눌렀을 때 되돌릴 수 있어야 한다 (계획서 9장)
    again = await client.post(
        f"/api/v1/medications/{target['medication_id']}/logs",
        headers={"Authorization": f"Bearer {st}"},
        json={"scheduled_at": target["scheduled_at"], "status": "missed"},
    )
    assert again.json()["status"] == "missed"

    after = await _today(client, st)
    assert after[0]["status"] == "missed"
    assert after[1]["status"] == "pending"


@pytest.mark.asyncio
async def test_guardian_cannot_answer(client):
    """자녀가 대신 눌러 주면 기록의 의미가 사라진다."""
    gt, st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id)

    doses = await _today(client, st)
    res = await client.post(
        f"/api/v1/medications/{doses[0]['medication_id']}/logs",
        headers={"Authorization": f"Bearer {gt}"},
        json={"scheduled_at": doses[0]["scheduled_at"], "status": "taken"},
    )
    assert res.status_code == 403
    assert res.json()["code"] == "SENIOR_ONLY"


@pytest.mark.asyncio
async def test_guardian_sees_senior_doses(client):
    gt, _st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id)

    doses = await _today(client, gt, f"?user_id={senior_id}")
    assert len(doses) == 2


@pytest.mark.asyncio
async def test_other_family_blocked(client):
    _gt, _st, senior_id = await _family(client)
    other = await _register(client, email="other@example.com", phone="010-7777-8888", name="남남")

    res = await client.get(
        f"/api/v1/medications?user_id={senior_id}",
        headers={"Authorization": f"Bearer {other['access_token']}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_delete_keeps_history(client):
    """복용 이력이 남아야 하므로 지우지 않고 내린다."""
    gt, st, senior_id = await _family(client)
    med = await _add_med(client, gt, senior_id)

    res = await client.delete(
        f"/api/v1/medications/{med['id']}", headers={"Authorization": f"Bearer {gt}"}
    )
    assert res.status_code == 200

    listed = await client.get(
        "/api/v1/medications", headers={"Authorization": f"Bearer {st}"}
    )
    assert listed.json() == []
    assert await _today(client, st) == []


@pytest.mark.asyncio
async def test_end_date_excludes_today(client):
    gt, st, senior_id = await _family(client)
    yesterday = (datetime.now(KST).date() - timedelta(days=1)).isoformat()
    await _add_med(client, gt, senior_id, end_date=yesterday)

    assert await _today(client, st) == []


@pytest.mark.asyncio
async def test_scheduled_at_is_kst_based(client):
    """08:00 KST 는 전날 23:00 UTC 다. 어긋나면 알림 시각이 틀어진다."""
    gt, st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id, times=["08:00"])

    doses = await _today(client, st)
    at = datetime.fromisoformat(doses[0]["scheduled_at"].replace("Z", "+00:00"))

    assert at.astimezone(KST).strftime("%H:%M") == "08:00"
    assert at.astimezone(UTC).hour == 23
