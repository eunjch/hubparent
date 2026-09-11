"""리포트(G1) · 이상 징후 알림(G2) — 계획서 8.2 · 8.4."""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.models.enums import AlertSeverity, AlertType
from app.models.monitor import Alert
from app.models.ops import AuditLog
from app.models.user import FamilyMember
from app.services import medication as med_service
from tests.test_medications import _add_med, _family, _today
from tests.test_onboarding import _register


async def _report(client, token, user_id):
    res = await client.get(
        f"/api/v1/reports/family/{user_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.asyncio
async def test_family_report_counts_today(client, session):
    gt, st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id, times=["08:00", "20:00"])
    today = med_service.today_kst().isoformat()
    h = {"Authorization": f"Bearer {st}"}

    await client.post("/api/v1/checks/meals", headers=h, json={"check_date": today, "slot": "breakfast", "status": "ate"})
    await client.post("/api/v1/checks/meals", headers=h, json={"check_date": today, "slot": "lunch", "status": "skipped"})
    await client.post("/api/v1/checks/moods", headers=h, json={"check_date": today, "slot": "breakfast", "mood": "good"})
    doses = await _today(client, st)
    await client.post(
        f"/api/v1/medications/{doses[0]['medication_id']}/logs",
        headers=h,
        json={"scheduled_at": doses[0]["scheduled_at"], "status": "taken"},
    )

    r = await _report(client, gt, senior_id)
    assert r["meal_done"] == 1
    assert r["med_taken"] == 1 and r["med_total"] == 2
    assert r["moods"] == [{"slot": "breakfast", "mood": "good"}]
    assert r["activity_level"] is None  # 신호 없음 = 기록 없음
    # (1 + 1 + 1) / (3 + 3 + 2)
    assert r["score"] == 38
    assert len(r["trend"]) == 7
    assert r["trend"][-1]["date"] == today and r["trend"][-1]["score"] == 38
    assert r["unread_alerts"] == 0

    # 보호자 조회는 감사 로그가 남는다
    audits = list(await session.scalars(select(AuditLog)))
    assert [a.action for a in audits] == ["view_report"]


@pytest.mark.asyncio
async def test_senior_sees_own_report_without_audit(client, session):
    _gt, st, senior_id = await _family(client)
    r = await _report(client, st, senior_id)
    assert r["score"] == 0
    assert list(await session.scalars(select(AuditLog))) == []


@pytest.mark.asyncio
async def test_activity_report_buckets_by_kst_hour(client):
    gt, st, senior_id = await _family(client)
    # KST 14:30 = UTC 05:30
    at = datetime(med_service.today_kst().year, med_service.today_kst().month, med_service.today_kst().day, 5, 30, tzinfo=UTC)
    res = await client.post(
        "/api/v1/signals",
        headers={"Authorization": f"Bearer {st}"},
        json={"signals": [{"recorded_at": at.isoformat(), "step_count": 900, "screen_on_count": 3}]},
    )
    assert res.status_code == 202, res.text

    res = await client.get(f"/api/v1/reports/activity/{senior_id}", headers={"Authorization": f"Bearer {gt}"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["steps"] == 900
    assert body["activity_level"] == "normal"
    assert body["hours"][14] == {"hour": 14, "steps": 900, "screen_on": 3}


@pytest.mark.asyncio
async def test_other_family_cannot_read_report(client):
    _gt, _st, senior_id = await _family(client)
    other = await _register(client, email="other@example.com", phone="010-7777-8888", name="남남")
    res = await client.get(
        f"/api/v1/reports/family/{senior_id}", headers={"Authorization": f"Bearer {other['access_token']}"}
    )
    assert res.status_code == 403


async def _seed_alerts(session, senior_id):
    senior_id = uuid.UUID(senior_id)
    family_id = await session.scalar(
        select(FamilyMember.family_id).where(FamilyMember.user_id == senior_id)
    )
    now = datetime.now(UTC)
    rows = [
        Alert(family_id=family_id, target_user_id=senior_id, type=AlertType.NO_RESPONSE,
              severity=AlertSeverity.HIGH, message="24시간 동안 응답이 없어요.", occurred_at=now),
        Alert(family_id=family_id, target_user_id=senior_id, type=AlertType.MISSED_MEDICATION,
              severity=AlertSeverity.LOW, message="복용 기록이 없어요", occurred_at=now),
    ]
    session.add_all(rows)
    await session.flush()
    return rows


@pytest.mark.asyncio
async def test_alert_filters_and_ack(client, session):
    gt, st, senior_id = await _family(client)
    high, low = await _seed_alerts(session, senior_id)
    h = {"Authorization": f"Bearer {gt}"}

    all_ = (await client.get("/api/v1/alerts", headers=h)).json()
    assert len(all_["items"]) == 2 and all_["unread"] == 2
    assert all_["items"][0]["target_name"] == "김영희"

    anomaly = (await client.get("/api/v1/alerts?filter=anomaly", headers=h)).json()
    assert [a["severity"] for a in anomaly["items"]] == ["high"]
    general = (await client.get("/api/v1/alerts?filter=general", headers=h)).json()
    assert [a["severity"] for a in general["items"]] == ["low"]

    # 벨의 점 — 리포트에도 미확인 수가 실린다
    assert (await _report(client, gt, senior_id))["unread_alerts"] == 2

    res = await client.post(f"/api/v1/alerts/{high.id}/ack", headers=h)
    assert res.status_code == 200 and res.json()["ack_at"] is not None
    assert (await client.get("/api/v1/alerts", headers=h)).json()["unread"] == 1

    res = await client.post("/api/v1/alerts/ack-all", headers=h, json={})
    assert res.status_code == 200
    assert (await client.get("/api/v1/alerts", headers=h)).json()["unread"] == 0

    # 어르신은 못 본다
    res = await client.get("/api/v1/alerts", headers={"Authorization": f"Bearer {st}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_alerts_are_family_scoped(client, session):
    _gt, _st, senior_id = await _family(client)
    high, _low = await _seed_alerts(session, senior_id)
    other = await _register(client, email="other@example.com", phone="010-7777-8888", name="남남")
    h = {"Authorization": f"Bearer {other['access_token']}"}

    assert (await client.get("/api/v1/alerts", headers=h)).json() == {"items": [], "unread": 0}
    res = await client.post(f"/api/v1/alerts/{high.id}/ack", headers=h)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_quiet_day_alert_waits_until_evening(client, session):
    """"오늘 아무 기록이 없다" 는 하루가 충분히 지난 뒤에만 판정한다.

    자정 직후에는 누구나 0건이다. 그때 재면 매일 새벽 모든 어르신에게 오탐이 난다
    (2026-09-11 재점검 — 날짜만 KST 로 고쳤더니 오탐이 아침에서 새벽으로 옮겨갔다).
    """
    from datetime import UTC, datetime

    from app.services import alert_engine
    from app.services import medication as med_service

    _gt, _st, _senior_id = await _family(client)
    day = med_service.today_kst()

    def at_kst(hour: int) -> datetime:
        return datetime(day.year, day.month, day.day, hour, 30, tzinfo=med_service.KST).astimezone(UTC)

    # 새벽 1시 30분 — 아직 판정하지 않는다
    assert await alert_engine.scan(session, now=at_kst(1)) == []
    # 낮 12시 30분 — 아직 이르다
    assert await alert_engine.scan(session, now=at_kst(12)) == []

    # 저녁 7시 30분 — 하루가 다 지났다. 이제 알린다
    created = await alert_engine.scan(session, now=at_kst(19))
    assert len(created) == 1
    assert created[0].type is AlertType.NO_CHECKS
