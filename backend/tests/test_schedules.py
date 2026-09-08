"""일정 — 자녀가 등록하고 어르신은 확인만 한다 (계획서 7.3)."""

from datetime import UTC, datetime, timedelta

import pytest

from tests.test_medications import _family


async def _add(client, gt, senior_id, **over):
    body = {
        "target_user_id": senior_id,
        "title": "서울○○병원 / 내과",
        "kind": "hospital",
        "start_at": (datetime.now(UTC) + timedelta(days=7)).isoformat(),
        "place": "서울○○병원",
        "reminder_minutes": [1440, 60],
        **over,
    }
    res = await client.post(
        "/api/v1/schedules", headers={"Authorization": f"Bearer {gt}"}, json=body
    )
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.asyncio
async def test_guardian_creates_schedule(client):
    gt, _st, senior_id = await _family(client)
    row = await _add(client, gt, senior_id)

    assert row["title"] == "서울○○병원 / 내과"
    # 먼 것부터 — 하루 전이 먼저 울린다
    assert row["reminder_minutes"] == [1440, 60]
    assert row["upcoming"] is True


@pytest.mark.asyncio
async def test_reminder_choices_are_limited(client):
    gt, _st, senior_id = await _family(client)
    res = await client.post(
        "/api/v1/schedules",
        headers={"Authorization": f"Bearer {gt}"},
        json={
            "target_user_id": senior_id,
            "title": "검진",
            "start_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "reminder_minutes": [37],
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_senior_cannot_create(client):
    """어르신 화면은 읽기 전용이다."""
    _gt, st, senior_id = await _family(client)
    res = await client.post(
        "/api/v1/schedules",
        headers={"Authorization": f"Bearer {st}"},
        json={
            "target_user_id": senior_id,
            "title": "내가 만든 일정",
            "start_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        },
    )
    assert res.status_code == 403
    assert res.json()["code"] == "GUARDIAN_ONLY"


@pytest.mark.asyncio
async def test_senior_can_read(client):
    gt, st, senior_id = await _family(client)
    await _add(client, gt, senior_id)

    res = await client.get("/api/v1/schedules", headers={"Authorization": f"Bearer {st}"})
    assert res.status_code == 200
    assert len(res.json()) == 1


@pytest.mark.asyncio
async def test_upcoming_scope_excludes_past(client):
    gt, st, senior_id = await _family(client)
    await _add(client, gt, senior_id)  # 7일 뒤
    await _add(
        client,
        gt,
        senior_id,
        title="지난 검진",
        start_at=(datetime.now(UTC) - timedelta(days=3)).isoformat(),
    )

    all_rows = await client.get("/api/v1/schedules", headers={"Authorization": f"Bearer {st}"})
    assert len(all_rows.json()) == 2

    upcoming = await client.get(
        "/api/v1/schedules?scope=upcoming", headers={"Authorization": f"Bearer {st}"}
    )
    assert len(upcoming.json()) == 1
    assert upcoming.json()[0]["title"] == "서울○○병원 / 내과"


@pytest.mark.asyncio
async def test_sorted_by_time(client):
    gt, st, senior_id = await _family(client)
    far = (datetime.now(UTC) + timedelta(days=30)).isoformat()
    near = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    await _add(client, gt, senior_id, title="나중", start_at=far)
    await _add(client, gt, senior_id, title="먼저", start_at=near)

    rows = (
        await client.get("/api/v1/schedules", headers={"Authorization": f"Bearer {st}"})
    ).json()
    assert [r["title"] for r in rows] == ["먼저", "나중"]


@pytest.mark.asyncio
async def test_update_and_delete(client):
    gt, st, senior_id = await _family(client)
    row = await _add(client, gt, senior_id)

    patched = await client.patch(
        f"/api/v1/schedules/{row['id']}",
        headers={"Authorization": f"Bearer {gt}"},
        json={"title": "치과 검진", "kind": "dental", "reminder_minutes": [60]},
    )
    assert patched.status_code == 200
    assert patched.json()["kind"] == "dental"
    assert patched.json()["reminder_minutes"] == [60]

    gone = await client.delete(
        f"/api/v1/schedules/{row['id']}", headers={"Authorization": f"Bearer {gt}"}
    )
    assert gone.status_code == 200

    rows = (
        await client.get("/api/v1/schedules", headers={"Authorization": f"Bearer {st}"})
    ).json()
    assert rows == []


@pytest.mark.asyncio
async def test_notify_records_time(client):
    """화면 G3 의 `부모님에게 알림 전송`. 실제 발송은 M3."""
    gt, _st, senior_id = await _family(client)
    row = await _add(client, gt, senior_id)
    assert row["notified_at"] is None

    res = await client.post(
        f"/api/v1/schedules/{row['id']}/notify", headers={"Authorization": f"Bearer {gt}"}
    )
    assert res.status_code == 200
    assert res.json()["notified_at"] is not None


@pytest.mark.asyncio
async def test_other_family_blocked(client):
    from tests.test_onboarding import _register

    gt, _st, senior_id = await _family(client)
    await _add(client, gt, senior_id)

    other = await _register(client, email="other@example.com", phone="010-7777-8888", name="남남")
    res = await client.get(
        f"/api/v1/schedules?user_id={senior_id}",
        headers={"Authorization": f"Bearer {other['access_token']}"},
    )
    assert res.status_code == 403
