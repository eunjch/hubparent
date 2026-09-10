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
async def test_medication_escalation(client, session, monkeypatch):
    """L0 → L1(+30분) → L2(+2시간, 보호자) → L3(마감, missed). 재알림은 플래그를 켜야 돈다."""
    from app.core.config import settings as _settings

    monkeypatch.setattr(_settings, "MED_ESCALATION", True)
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
async def test_answer_stops_escalation(client, session, monkeypatch):
    from app.core.config import settings as _settings

    monkeypatch.setattr(_settings, "MED_ESCALATION", True)
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
async def test_changed_time_pushes_at_new_time(client, session):
    """복용 시각을 바꾸면 옛 시각엔 안 가고 새 시각에 간다 (worker 가 매 분 현재 규칙을 다시 읽는다)."""
    gt, _st, senior_id = await _family(client)
    med = await _add_med(client, gt, senior_id, times=["08:00"])
    today = med_service.today_kst()
    old_at = med_service.to_utc(today, "08:00")
    new_at = med_service.to_utc(today, "09:30")

    res = await client.patch(
        f"/api/v1/medications/{med['id']}",
        headers={"Authorization": f"Bearer {gt}"},
        json={"times": ["09:30"]},
    )
    assert res.status_code == 200, res.text

    assert await medication_reminder.remind(session, now=old_at + timedelta(minutes=1)) == 0
    assert await medication_reminder.remind(session, now=new_at + timedelta(seconds=30)) == 1
    pushed = list(await session.scalars(select(NotificationLog).where(NotificationLog.kind == "push")))
    assert len(pushed) == 1
    assert new_at.isoformat() in pushed[0].dedupe_key


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


def test_platform_specific_alarm_payload():
    """복약만 알람음 + 집중 모드 관통. 안드로이드는 채널로, iOS 는 알림마다 얹어서 같은 결과를 낸다."""
    from firebase_admin import messaging
    from firebase_admin._messaging_encoder import MessageEncoder

    from app.services import push

    assert push.android_channel("medication") == "medication_alarm"
    assert push.android_channel("schedule") == "schedule"
    assert push.ios_sound("medication") == push.IOS_ALARM_SOUND
    assert push.ios_sound("report") == "default"
    assert push.ios_interruption_level("medication") == "time-sensitive"
    assert push.ios_interruption_level("anomaly") == "time-sensitive"
    assert push.ios_interruption_level("schedule") == "active"

    # interruption-level 은 aps 딕셔너리 안에 있어야 애플이 읽는다
    message = messaging.Message(
        token="t",
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    sound=push.ios_sound("medication"),
                    custom_data={"interruption-level": push.ios_interruption_level("medication")},
                )
            )
        ),
    )
    aps = MessageEncoder().default(message)["apns"]["payload"]["aps"]
    assert aps["sound"] == "medic_alarm.wav"
    assert aps["interruption-level"] == "time-sensitive"


def test_ios_alarm_sound_is_bundled_and_under_apple_limit():
    """음원이 Xcode 리소스로 등록돼 있고 30초 미만인지. 둘 중 하나만 틀려도 기본음이 난다."""
    import wave
    from pathlib import Path

    from app.services import push

    root = Path(__file__).resolve().parents[2]
    sound = root / "mobile" / "ios" / "App" / "App" / push.IOS_ALARM_SOUND
    assert sound.is_file(), f"{sound} 없음"

    with wave.open(str(sound), "rb") as f:
        seconds = f.getnframes() / f.getframerate()
    assert seconds < 30, f"{seconds}초 — 애플 제한은 30초 미만"

    project = root / "mobile" / "ios" / "App" / "App.xcodeproj" / "project.pbxproj"
    pbxproj = project.read_text(encoding="utf-8")
    assert f"{push.IOS_ALARM_SOUND} in Resources" in pbxproj, "Xcode 리소스로 등록되지 않았다"


@pytest.mark.asyncio
async def test_push_splits_by_platform_and_prunes_dead_tokens(client, session, monkeypatch):
    """안드로이드는 FCM, iOS 는 애플로 직접. 양쪽에서 죽은 토큰은 함께 지운다. 실제 발송은 안 한다."""
    from sqlalchemy import select as _select

    from app.models.user import Device
    from app.services import apns, push

    _gt, st, senior_id = await _family(client)
    # 같은 플랫폼이면 토큰이 덮어써지므로(upsert) 플랫폼을 달리한다
    for tok, platform in (("tok-android", "android"), ("tok-ios", "ios")):
        res = await client.post(
            "/api/v1/devices",
            headers={"Authorization": f"Bearer {st}"},
            json={"platform": platform, "push_token": tok, "app_version": "0.1.0"},
        )
        assert res.status_code == 200, res.text

    fcm: list[dict] = []
    apple: list[dict] = []

    async def fake_deliver(tokens, title, body, channel, route):
        fcm.append({"tokens": sorted(tokens), "channel": channel})
        return []

    async def fake_apns(tokens, *, title, body, sound, level, channel, route):
        apple.append({"tokens": sorted(tokens), "sound": sound, "level": level, "route": route})
        return ["tok-ios"]  # 애플이 "이제 없는 토큰" 이라고 답한 셈

    monkeypatch.setattr(push, "configured", lambda: True)
    monkeypatch.setattr(push, "_deliver", fake_deliver)
    monkeypatch.setattr(apns, "configured", lambda: True)
    monkeypatch.setattr(apns, "send", fake_apns)

    import uuid as _uuid

    row = await push.send(
        session,
        _uuid.UUID(senior_id),
        title="약 드실 시간이에요",
        body="혈압약",
        channel="medication",
        route="/s/med",
    )
    assert row.event == "sent"
    assert fcm == [{"tokens": ["tok-android"], "channel": "medication"}]
    assert apple == [
        {"tokens": ["tok-ios"], "sound": "medic_alarm.wav", "level": "time-sensitive", "route": "/s/med"}
    ]

    left = list(await session.scalars(_select(Device.push_token)))
    assert left == ["tok-android"]


@pytest.mark.asyncio
async def test_push_logs_when_apns_unconfigured(client, session, monkeypatch):
    """애플 키가 없으면 iOS 는 못 보낸다. 죽지 말고 이력에 남겨야 나중에 답할 수 있다."""
    from app.services import apns, push

    _gt, st, senior_id = await _family(client)
    res = await client.post(
        "/api/v1/devices",
        headers={"Authorization": f"Bearer {st}"},
        json={"platform": "ios", "push_token": "tok-ios", "app_version": "0.1.0"},
    )
    assert res.status_code == 200, res.text

    monkeypatch.setattr(apns, "configured", lambda: False)

    import uuid as _uuid

    row = await push.send(
        session,
        _uuid.UUID(senior_id),
        title="약 드실 시간이에요",
        body="혈압약",
        channel="medication",
        route="/s/med",
    )
    assert row.event == "skipped"
    assert row.detail is not None and "APNs 미설정" in row.detail


def test_apns_payload_shape():
    """aps 안은 애플이, 그 옆은 앱이 읽는다. 앱은 data.route 로 화면을 연다."""
    from app.services import apns

    payload = apns.build_payload(
        "약 드실 시간이에요", "08:00 혈압약 1정", "medic_alarm.wav", "time-sensitive", "medication", "/s/med"
    )
    assert payload["aps"]["alert"] == {"title": "약 드실 시간이에요", "body": "08:00 혈압약 1정"}
    assert payload["aps"]["sound"] == "medic_alarm.wav"
    assert payload["aps"]["interruption-level"] == "time-sensitive"
    assert payload["route"] == "/s/med"
    assert payload["channel"] == "medication"


def test_apns_unconfigured_without_key_file(monkeypatch):
    from app.core.config import settings as _settings
    from app.services import apns

    monkeypatch.setattr(_settings, "APNS_KEY_PATH", "")
    assert apns.configured() is False
    monkeypatch.setattr(_settings, "APNS_KEY_PATH", "없는파일.p8")
    monkeypatch.setattr(_settings, "APNS_KEY_ID", "ABC123")
    monkeypatch.setattr(_settings, "APNS_TEAM_ID", "TEAM123")
    assert apns.configured() is False


@pytest.mark.asyncio
async def test_dedupe_key_fits_column():
    """운영 장애 재현: 보호자 키 112자 → 80자 컬럼에 안 들어가 워커가 죽었다."""
    import uuid as _uuid

    from app.models.notify import NotificationLog
    from app.services.push import DEDUPE_MAX, fit_key

    key = f"med-guardian:{_uuid.uuid4()}:2026-09-08T23:00:00+00:00:{_uuid.uuid4()}"
    assert len(key) > 80
    assert len(key) <= DEDUPE_MAX
    assert NotificationLog.__table__.c.dedupe_key.type.length >= len(key)

    # 그보다 더 길어도 컬럼 안으로 줄이고, 같은 입력은 같은 결과
    huge = "x" * 500
    assert len(fit_key(huge)) <= DEDUPE_MAX
    assert fit_key(huge) == fit_key(huge)
    assert fit_key(key) == key


@pytest.mark.asyncio
async def test_apns_signs_and_sends_real_request(monkeypatch, tmp_path):
    """진짜 ES256 키로 서명해 실제 요청을 만든다. 네트워크만 가짜다.

    여기서 잡으려는 것: 서명 실패, URL·헤더 오타, 죽은 토큰 판별.
    """
    import httpx
    import jwt as pyjwt
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.serialization import (
        Encoding,
        NoEncryption,
        PrivateFormat,
    )

    from app.core.config import settings as _settings
    from app.services import apns

    # 애플이 주는 .p8 과 같은 형식(PKCS8 PEM · P-256)
    key = ec.generate_private_key(ec.SECP256R1())
    p8 = tmp_path / "AuthKey_TEST123.p8"
    p8.write_bytes(key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()))

    monkeypatch.setattr(_settings, "APNS_KEY_PATH", str(p8))
    monkeypatch.setattr(_settings, "APNS_KEY_ID", "TEST123")
    monkeypatch.setattr(_settings, "APNS_TEAM_ID", "TEAM456")
    monkeypatch.setattr(_settings, "APNS_TOPIC", "kr.co.mangotree.hubfamily")
    monkeypatch.setattr(_settings, "APNS_SANDBOX", False)
    monkeypatch.setattr(apns, "_jwt_cache", None)
    assert apns.configured() is True

    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path.endswith("tok-dead"):
            return httpx.Response(410, json={"reason": "Unregistered"})
        return httpx.Response(200)

    monkeypatch.setattr(
        apns, "_http", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler))
    )

    dead = await apns.send(
        ["tok-ok", "tok-dead"],
        title="약 드실 시간이에요",
        body="08:00 혈압약 1정",
        sound="medic_alarm.wav",
        level="time-sensitive",
        channel="medication",
        route="/s/med",
    )
    assert dead == ["tok-dead"]
    assert len(seen) == 2

    req = next(r for r in seen if r.url.path.endswith("tok-ok"))
    assert str(req.url) == "https://api.push.apple.com/3/device/tok-ok"
    assert req.headers["apns-topic"] == "kr.co.mangotree.hubfamily"
    assert req.headers["apns-push-type"] == "alert"
    assert req.headers["apns-priority"] == "10"

    # 서명이 실제로 검증되는지 — 공개키로 풀어 본다
    bearer = req.headers["authorization"].removeprefix("bearer ")
    assert pyjwt.get_unverified_header(bearer)["kid"] == "TEST123"
    claims = pyjwt.decode(bearer, key.public_key(), algorithms=["ES256"])
    assert claims["iss"] == "TEAM456"

    import json as _json

    body = _json.loads(req.content)
    assert body["aps"]["alert"]["title"] == "약 드실 시간이에요"
    assert body["aps"]["sound"] == "medic_alarm.wav"
    assert body["aps"]["interruption-level"] == "time-sensitive"
    assert body["route"] == "/s/med"


@pytest.mark.asyncio
async def test_apns_retries_other_environment_on_bad_device_token(monkeypatch, tmp_path):
    """sandbox 빌드 토큰을 production 에 보내면 BadDeviceToken 이다. 반대쪽으로 한 번 더 간다."""
    import httpx
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.serialization import (
        Encoding,
        NoEncryption,
        PrivateFormat,
    )

    from app.core.config import settings as _settings
    from app.services import apns

    key = ec.generate_private_key(ec.SECP256R1())
    p8 = tmp_path / "AuthKey_TEST123.p8"
    p8.write_bytes(key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()))
    monkeypatch.setattr(_settings, "APNS_KEY_PATH", str(p8))
    monkeypatch.setattr(_settings, "APNS_KEY_ID", "TEST123")
    monkeypatch.setattr(_settings, "APNS_TEAM_ID", "TEAM456")
    monkeypatch.setattr(_settings, "APNS_SANDBOX", False)
    monkeypatch.setattr(apns, "_jwt_cache", None)

    hosts: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        hosts.append(request.url.host)
        if request.url.host == "api.push.apple.com":
            return httpx.Response(400, json={"reason": "BadDeviceToken"})
        return httpx.Response(200)

    monkeypatch.setattr(
        apns, "_http", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler))
    )

    dead = await apns.send(
        ["tok-sandbox"],
        title="약 드실 시간이에요",
        body="혈압약",
        sound="medic_alarm.wav",
        level="time-sensitive",
        channel="medication",
        route="/s/med",
    )
    assert dead == []  # 반대쪽에서 성공했으니 지우면 안 된다
    assert hosts == ["api.push.apple.com", "api.sandbox.push.apple.com"]

