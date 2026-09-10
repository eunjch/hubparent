"""서버 푸시 발송 — 계획서 8.5 "푸시가 주(主)".

FCM(firebase-admin)으로 보낸다. 자격증명(FCM_CREDENTIALS_PATH)이 없으면 발송 없이 이력만 남긴다 —
무엇을 언제 보내려 했는지는 그때부터 쌓여야 "안 울렸어요" 문의에 답할 수 있다 (8.5.11).

payload 는 알림(title/body) + 데이터(route/channel) 다. 앱은 data.route 로 화면을 연다 (8.5.9).
안드로이드 채널 ID 는 앱이 만든 4개와 같아야 한다 (8.5.7): medication · anomaly · schedule · report.

플랫폼마다 "알람처럼 울리게" 하는 방법이 다르다.
  안드로이드  채널이 소리를 정한다 → 복약은 medication_alarm (USAGE_ALARM · 30초)
  iOS         채널이 없다 → 알림마다 소리 파일과 interruption-level 을 직접 얹는다
"""

import hashlib
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import DevicePlatform, UserRole
from app.models.notify import NotificationLog
from app.models.user import Device, FamilyMember
from app.services import apns

log = logging.getLogger("hubfamily.push")

_app = None
_init_failed = False


def configured() -> bool:
    return bool(settings.FCM_CREDENTIALS_PATH) and Path(settings.FCM_CREDENTIALS_PATH).is_file()


def _firebase():
    """firebase-admin 앱을 한 번만 만든다. 실패하면 이 프로세스에서는 다시 시도하지 않는다."""
    global _app, _init_failed
    if _app is not None or _init_failed:
        return _app
    try:
        import firebase_admin
        from firebase_admin import credentials

        _app = firebase_admin.initialize_app(credentials.Certificate(settings.FCM_CREDENTIALS_PATH))
        log.info("FCM 준비됨 (%s)", settings.FCM_CREDENTIALS_PATH)
    except Exception as exc:  # noqa: BLE001
        _init_failed = True
        log.error("FCM 초기화 실패: %s", exc)
    return _app


async def _deliver(tokens: list[str], title: str, body: str, channel: str, route: str) -> list[str]:
    """실제 발송. 더 이상 유효하지 않은 토큰 목록을 돌려준다 (단말에서 앱을 지운 경우 등)."""
    from firebase_admin import messaging

    app = _firebase()
    if app is None:
        raise RuntimeError("FCM 초기화 실패")

    message = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(title=title, body=body),
        data={"route": route, "channel": channel},
        android=messaging.AndroidConfig(
            priority="high",
            # 복약은 앱의 알람 채널(USAGE_ALARM · 30초 알람음)로. 채널이 소리를 정하므로 sound 는 비운다
            notification=messaging.AndroidNotification(channel_id=android_channel(channel)),
        ),
        apns=messaging.APNSConfig(
            # priority 10 = 지금 바로. 약 시간은 미뤄서 받을 이유가 없다
            headers={"apns-priority": "10", "apns-push-type": "alert"},
            payload=messaging.APNSPayload(
                aps=messaging.Aps(
                    sound=ios_sound(channel),
                    badge=1,
                    # Aps 에 없는 키는 custom_data 로 aps 딕셔너리에 그대로 실린다
                    custom_data={"interruption-level": ios_interruption_level(channel)},
                ),
            ),
        ),
    )
    result = messaging.send_each_for_multicast(message, app=app)

    dead: list[str] = []
    for token, resp in zip(tokens, result.responses, strict=True):
        if resp.success:
            continue
        exc = resp.exception
        name = type(exc).__name__ if exc else "?"
        if name in {"UnregisteredError", "SenderIdMismatchError"}:
            dead.append(token)
        else:
            log.warning("푸시 실패 token=%s…: %s", token[:12], exc)
    if result.success_count == 0:
        raise RuntimeError(f"모든 단말 실패 ({result.failure_count}건)")
    return dead


def android_channel(channel: str) -> str:
    """서버 채널 이름 → 안드로이드 채널 ID. 앱의 native/alarm-channel.ts 와 같은 규칙."""
    return "medication_alarm" if channel == "medication" else channel


# 앱 번들에 든 알람음. 안드로이드용 30초를 29초로 잘라 넣었다 — 애플 제한이 "30초 미만" 이라
# 딱 30.0 이면 무시되고 기본음이 난다. mobile/ios/App/App/medic_alarm.wav
IOS_ALARM_SOUND = "medic_alarm.wav"


def ios_sound(channel: str) -> str:
    """복약만 알람음, 나머지는 시스템 기본음."""
    return IOS_ALARM_SOUND if channel == "medication" else "default"


def ios_interruption_level(channel: str) -> str:
    """알림이 얼마나 세게 끼어드는가.

    time-sensitive 는 집중 모드를 뚫고 잠금화면에 크게 뜬다. 애플 승인이 필요 없는 선이 여기까지다.
    무음 스위치까지 무시하려면 Critical Alerts 를 따로 신청해야 한다 — 지금은 안 쓴다.
    """
    return "time-sensitive" if channel in {"medication", "anomaly"} else "active"


DEDUPE_MAX = 200


def fit_key(key: str | None) -> str | None:
    """컬럼 길이를 넘는 키는 앞부분 + 해시로 줄인다. 같은 입력이면 같은 결과라 중복 방지는 유지된다."""
    if key is None or len(key) <= DEDUPE_MAX:
        return key
    digest = hashlib.sha1(key.encode()).hexdigest()[:16]
    return f"{key[: DEDUPE_MAX - 17]}#{digest}"


async def already_sent(session: AsyncSession, dedupe_key: str) -> bool:
    row = await session.scalar(
        select(NotificationLog.id).where(NotificationLog.dedupe_key == dedupe_key).limit(1)
    )
    return row is not None


async def send(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    title: str,
    body: str,
    channel: str,
    route: str,
    dedupe_key: str | None = None,
) -> NotificationLog:
    """사용자의 모든 단말로 푸시를 보내고 이력을 남긴다.

    dedupe_key 가 있으면 같은 키로 이미 보낸 건은 다시 보내지 않는다.
    """
    dedupe_key = fit_key(dedupe_key)
    if dedupe_key and await already_sent(session, dedupe_key):
        existing = await session.scalar(
            select(NotificationLog).where(NotificationLog.dedupe_key == dedupe_key).limit(1)
        )
        assert existing is not None
        return existing

    rows = (
        await session.execute(
            select(Device.platform, Device.push_token).where(
                Device.user_id == user_id, Device.push_token.is_not(None)
            )
        )
    ).all()
    android = [t for p, t in rows if p != DevicePlatform.IOS]
    ios = [t for p, t in rows if p == DevicePlatform.IOS]

    event = "skipped"
    detail: str | None = None
    if not rows:
        detail = "등록된 단말 없음"
    else:
        dead: list[str] = []
        notes: list[str] = []
        sent_any = False

        # 안드로이드 — FCM. 채널이 소리를 정한다
        if android:
            if configured():
                try:
                    dead += await _deliver(android, title, body, channel, route)
                    sent_any = True
                except Exception as exc:  # noqa: BLE001 — 발송 실패는 이력으로만 남긴다
                    notes.append(f"FCM: {exc}")
                    log.warning("FCM 실패 user=%s: %s", user_id, exc)
            else:
                notes.append("FCM 미설정")

        # iOS — 애플에 직접. 소리와 끼어드는 세기를 알림마다 얹는다
        if ios:
            if apns.configured():
                try:
                    dead += await apns.send(
                        ios,
                        title=title,
                        body=body,
                        sound=ios_sound(channel),
                        level=ios_interruption_level(channel),
                        channel=channel,
                        route=route,
                    )
                    sent_any = True
                except Exception as exc:  # noqa: BLE001
                    notes.append(f"APNs: {exc}")
                    log.warning("APNs 실패 user=%s: %s", user_id, exc)
            else:
                notes.append("APNs 미설정")

        if dead:
            # 지운 앱의 토큰은 버린다. 다음 로그인 때 새 토큰이 올라온다
            await session.execute(delete(Device).where(Device.push_token.in_(dead)))
            notes.append(f"만료 토큰 {len(dead)}개 정리")

        if sent_any:
            event = "sent"
        elif any(n.startswith(("FCM:", "APNs:")) for n in notes):
            event = "failed"
        detail = " · ".join(notes)[:200] or None

    row = NotificationLog(
        user_id=user_id,
        kind="push",
        event=event,
        channel=channel,
        title=title,
        dedupe_key=dedupe_key,
        at=datetime.now(UTC),
        detail=detail,
    )
    session.add(row)
    await session.flush()
    return row


async def guardians_of(session: AsyncSession, family_id: uuid.UUID) -> list[uuid.UUID]:
    rows = await session.scalars(
        select(FamilyMember.user_id).where(
            FamilyMember.family_id == family_id, FamilyMember.role == UserRole.GUARDIAN
        )
    )
    return list(rows)


async def send_to_guardians(
    session: AsyncSession,
    family_id: uuid.UUID,
    *,
    title: str,
    body: str,
    channel: str,
    route: str,
    dedupe_key: str | None = None,
) -> int:
    """가족의 보호자 전원에게. 이상 징후·하루 요약이 쓴다."""
    count = 0
    for gid in await guardians_of(session, family_id):
        key = f"{dedupe_key}:{gid}" if dedupe_key else None
        await send(session, gid, title=title, body=body, channel=channel, route=route, dedupe_key=key)
        count += 1
    return count
