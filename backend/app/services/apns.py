"""애플 푸시(APNs) 직접 발송 — 계획서 8.5.

왜 FCM 을 안 쓰나: iOS 앱의 Capacitor 푸시 플러그인은 **APNs 토큰**을 준다
(플러그인 문서 그대로 "On iOS it contains the APNS token"). FCM 은 이 토큰을 못 받는다.
안드로이드용으로 앱을 갈아엎지 않으려고, iOS 만 서버에서 애플로 직접 보낸다 (2026-09-10 결정).

인증은 .p8 키로 만든 ES256 JWT 다. 키 하나가 팀의 모든 앱에 쓰이고 만료가 없다 —
서버에 올려 두는 비밀은 이 파일 하나뿐이다. 애플은 JWT 를 20분보다 자주 새로 만들면 거절하고
60분이 넘으면 만료로 본다. 그 사이인 40분마다 새로 만든다.

개발/운영 환경이 갈린다. Xcode 로 폰에 직접 설치한 빌드는 sandbox, TestFlight·App Store 는
production 이고, 토큰을 반대쪽에 보내면 BadDeviceToken 이 온다. 설정한 쪽을 먼저 쓰되
BadDeviceToken 이면 반대쪽으로 한 번 더 시도한다 — 개발 중에 이것 때문에 헤매지 않도록.
"""

import asyncio
import json
import logging
import time
from pathlib import Path

import httpx
import jwt

from app.core.config import settings

log = logging.getLogger("hubfamily.apns")

PROD_HOST = "https://api.push.apple.com"
SANDBOX_HOST = "https://api.sandbox.push.apple.com"

# 애플이 "이 토큰은 이제 없다" 고 답하는 경우들. 단말에서 앱을 지웠거나 토큰이 뒤집힌 것이다.
DEAD_REASONS = {"BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"}

_JWT_TTL_SECONDS = 40 * 60

_jwt_cache: tuple[str, float] | None = None
_client: httpx.AsyncClient | None = None


def configured() -> bool:
    if not (
        settings.APNS_KEY_PATH and settings.APNS_KEY_ID and settings.APNS_TEAM_ID and settings.APNS_TOPIC
    ):
        return False
    key = Path(settings.APNS_KEY_PATH)
    # 배포 스크립트가 만들어 두는 빈 자리 파일은 "아직 없음" 이다
    return key.is_file() and key.stat().st_size > 0


def _auth_token() -> str:
    """캐시된 JWT. 40분마다 새로 만든다."""
    global _jwt_cache
    now = time.time()
    if _jwt_cache is not None and now - _jwt_cache[1] < _JWT_TTL_SECONDS:
        return _jwt_cache[0]

    key = Path(settings.APNS_KEY_PATH).read_text(encoding="utf-8")
    token = jwt.encode(
        {"iss": settings.APNS_TEAM_ID, "iat": int(now)},
        key,
        algorithm="ES256",
        headers={"kid": settings.APNS_KEY_ID},
    )
    _jwt_cache = (token, now)
    return token


def _http() -> httpx.AsyncClient:
    """APNs 는 HTTP/2 만 받는다. 연결은 재사용한다 — 매번 새로 맺으면 발송이 몇 배 느리다."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(http2=True, timeout=10.0)
    return _client


async def aclose() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


def build_payload(title: str, body: str, sound: str, level: str, channel: str, route: str) -> dict:
    """aps 는 애플이 읽고, 그 옆의 키들은 앱이 읽는다 (앱은 data.route 로 화면을 연다)."""
    return {
        "aps": {
            "alert": {"title": title, "body": body},
            "sound": sound,
            "badge": 1,
            "interruption-level": level,
        },
        "route": route,
        "channel": channel,
    }


async def _post(token: str, payload: dict, host: str) -> tuple[int, str]:
    """한 단말에 한 번. (상태코드, 애플이 준 이유) 를 돌려준다."""
    res = await _http().post(
        f"{host}/3/device/{token}",
        content=json.dumps(payload, ensure_ascii=False).encode(),
        headers={
            "authorization": f"bearer {_auth_token()}",
            "apns-topic": settings.APNS_TOPIC,
            "apns-push-type": "alert",
            # 10 = 지금 바로. 약 시간은 미뤄서 받을 이유가 없다
            "apns-priority": "10",
            "content-type": "application/json",
        },
    )
    if res.status_code == 200:
        return res.status_code, ""
    try:
        reason = res.json().get("reason", "")
    except ValueError:
        reason = res.text[:80]
    return res.status_code, reason


async def send(
    tokens: list[str], *, title: str, body: str, sound: str, level: str, channel: str, route: str
) -> list[str]:
    """iOS 단말들에 보낸다. 더 이상 유효하지 않은 토큰을 돌려준다.

    모두 실패하면 예외를 올린다 — 호출한 쪽이 이력에 failed 로 남긴다.
    """
    if not configured():
        raise RuntimeError("APNs 미설정")

    payload = build_payload(title, body, sound, level, channel, route)
    primary = SANDBOX_HOST if settings.APNS_SANDBOX else PROD_HOST
    fallback = PROD_HOST if settings.APNS_SANDBOX else SANDBOX_HOST

    async def one(token: str) -> tuple[str, bool, str]:
        status, reason = await _post(token, payload, primary)
        # 환경이 반대였을 뿐일 수 있다. 한 번만 더 해 본다
        if reason == "BadDeviceToken":
            status, reason = await _post(token, payload, fallback)
            if status == 200:
                log.info("APNs 토큰이 %s 환경이었다 — 설정을 확인할 것", fallback)
        return token, status == 200, reason

    results = await asyncio.gather(*(one(t) for t in tokens), return_exceptions=True)

    dead: list[str] = []
    sent = 0
    errors: list[str] = []
    for token, result in zip(tokens, results, strict=True):
        if isinstance(result, BaseException):
            errors.append(str(result)[:80])
            continue
        _, ok, reason = result
        if ok:
            sent += 1
        elif reason in DEAD_REASONS:
            dead.append(token)
        else:
            errors.append(reason or "?")
            log.warning("APNs 실패 token=%s…: %s", token[:12], reason)

    if sent == 0 and (errors or not dead):
        raise RuntimeError(f"APNs 전부 실패 ({', '.join(errors) or '유효한 토큰 없음'})")
    return dead
