"""로컬 알림 계획 · 복약 에스컬레이션 · 발송 이력 (계획서 8.1 · 8.5)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.care import MedicationLog
from app.models.enums import MedicationStatus
from app.models.notify import NotificationLog
from app.services import medication as med_service
from app.services import medication_reminder
from tests.test_medications import _add_med, _family, _today


async def _plan(client, token, days=14):
    res = await client.get(
        f"/api/v1/notifications/plan?days={days}", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.asyncio
async def test_plan_has_medications_and_schedules(client):
    gt, st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id, times=["08:00", "20:00"])

    start = datetime.now(UTC) + timedelta(days=3)
    res = await client.post(
        "/api/v1/schedules",
        headers={"Authorization": f"Bearer {gt}"},
        json={
            "target_user_id": senior_id,
            "title": "내과",
            "place": "서울○○병원",
            "start_at": start.isoformat(),
            "reminder_minutes": [1440, 60],
        },
    )
    assert res.status_code == 200, res.text

    plan = await _plan(client, st)
    items = plan["items"]
    assert plan["revoked_ids"] == []

    meds = [i for i in items if i["channel"] == "medication"]
    schs = [i for i in items if i["channel"] == "schedule"]
    # 2주 × 2회 = 28 안팎 (오늘 지난 시각은 빠진다)
    assert 26 <= len(meds) <= 30
    assert len(schs) == 2
    assert {s["title"] for s in schs} == {"내일 일정이 있어요", "1시간 후 일정이 있어요"}
    assert schs[0]["body"] == "서울○○병원 / 내과"
    assert schs[0]["route"] == "/s/schedule"

    # 시각 순, ID 는 int
    ats = [i["at"] for i in items]
    assert ats == sorted(ats)
    assert all(isinstance(i["local_id"], int) for i in items)


@pytest.mark.asyncio
async def test_plan_is_stable_and_revokes_removed(client):
    """같은 건은 같은 ID 를 유지하고, 지운 일정의 ID 는 revoked 로 내려온다."""
    gt, st, senior_id = await _family(client)
    start = datetime.now(UTC) + timedelta(days=2)
    res = await client.post(
        "/api/v1/schedules",
        headers={"Authorization": f"Bearer {gt}"},
        json={"target_user_id": senior_id, "title": "치과", "start_at": start.isoformat(), "reminder_minutes": [60]},
    )
    sch_id = res.json()["id"]

    first = await _plan(client, st)
    second = await _plan(client, st)
    assert [i["local_id"] for i in first["items"]] == [i["local_id"] for i in second["items"]]
    local_id = first["items"][0]["local_id"]

    await client.delete(f"/api/v1/schedules/{sch_id}", headers={"Authorization": f"Bearer {gt}"})
    after = await _plan(client, st)
    assert after["items"] == []
    assert after["revoked_ids"] == [local_id]


@pytest.mark.asyncio
async def test_iOS_cap(client):
    gt, st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id, times=["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"])
    plan = await _plan(client, st, days=30)
    assert len(plan["items"]) == 60


@pytest.mark.asyncio
async def test_guardian_gets_empty_plan(client):
    gt, _st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id)
    assert (await _plan(client, gt))["items"] == []


@pytest.mark.asyncio
async def test_device_report_is_logged(client, session):
    gt, st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id)
    plan = await _plan(client, st)
    local_id = plan["items"][0]["local_id"]

    res = await client.post(
        "/api/v1/notifications/report",
        headers={"Authorization": f"Bearer {st}"},
        json={"events": [{"local_id": local_id, "event": "scheduled", "at": datetime.now(UTC).isoformat()}]},
    )
    assert res.status_code == 200

    logs = list(await session.scalars(select(NotificationLog).where(NotificationLog.kind == "local")))
    assert len(logs) == 1
    assert logs[0].local_id == local_id
    assert logs[0].title == "약 드실 시간이에요"


@pytest.mark.asyncio
async def test_medication_escalation(client, session):
    """L0 → L1(+30분) → L2(+2시간, 보호자) → L3(마감, missed)."""
    gt, st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id, times=["08:00"])
    today = med_service.today_kst()
    at = med_service.to_utc(today, "08:00")

    async def pushes():
        return list(await session.scalars(select(NotificationLog).where(NotificationLog.kind == "push")))

    # 아직 예정 전
    assert await medication_reminder.remind(session, now=at - timedelta(minutes=1)) == 0

    # L0
    assert await medication_reminder.remind(session, now=at + timedelta(minutes=1)) == 1
    assert await medication_reminder.remind(session, now=at + timedelta(minutes=5)) == 0  # 같은 단계 반복 없음
    assert [p.title for p in await pushes()] == ["약 드실 시간이에요"]
    assert (await pushes())[0].event == "skipped"  # FCM 미설정이어도 이력은 남는다

    # 어르신 화면에는 여전히 pending 으로 보인다
    doses = await _today(client, st)
    assert doses[0]["status"] == "pending"

    # L1
    assert await medication_reminder.remind(session, now=at + timedelta(minutes=31)) == 1
    # L2 — 보호자에게도 간다
    assert await medication_reminder.remind(session, now=at + timedelta(hours=2, minutes=1)) == 1
    titles = [p.title for p in await pushes()]
    assert titles.count("부모님이 아직 약을 안 드셨어요") == 1
    assert len(titles) == 4

    # L3 — 마감. missed 확정 + 일반 알림
    assert await medication_reminder.close_day(session, today) == 1
    log = await session.scalar(select(MedicationLog))
    assert log.status is MedicationStatus.MISSED
    assert log.reminder_level == 3

    alerts = await client.get(
        "/api/v1/alerts?filter=general", headers={"Authorization": f"Bearer {gt}"}
    )
    assert alerts.status_code == 200
    body = alerts.json()
    assert body["unread"] == 1
    assert body["items"][0]["type"] == "missed_med"
    assert "08:00 혈압약" in body["items"][0]["message"]


@pytest.mark.asyncio
async def test_answer_stops_escalation(client, session):
    gt, st, senior_id = await _family(client)
    await _add_med(client, gt, senior_id, times=["08:00"])
    today = med_service.today_kst()
    at = med_service.to_utc(today, "08:00")

    await medication_reminder.remind(session, now=at + timedelta(minutes=1))
    doses = await _today(client, st)
    res = await client.post(
        f"/api/v1/medications/{doses[0]['medication_id']}/logs",
        headers={"Authorization": f"Bearer {st}"},
        json={"scheduled_at": doses[0]["scheduled_at"], "status": "taken"},
    )
    assert res.status_code == 200, res.text

    assert await medication_reminder.remind(session, now=at + timedelta(hours=3)) == 0
    assert await medication_reminder.close_day(session, today) == 0


@pytest.mark.asyncio
async def test_schedule_notify_sends_push(client, session):
    gt, _st, senior_id = await _family(client)
    start = datetime.now(UTC) + timedelta(days=1)
    res = await client.post(
        "/api/v1/schedules",
        headers={"Authorization": f"Bearer {gt}"},
        json={"target_user_id": senior_id, "title": "내과", "place": "서울○○병원", "start_at": start.isoformat()},
    )
    sch_id = res.json()["id"]

    res = await client.post(f"/api/v1/schedules/{sch_id}/notify", headers={"Authorization": f"Bearer {gt}"})
    assert res.status_code == 200
    assert res.json()["notified_at"] is not None

    logs = list(await session.scalars(select(NotificationLog)))
    assert len(logs) == 1
    assert logs[0].channel == "schedule"
    assert logs[0].title.endswith("일정이 있어요")
