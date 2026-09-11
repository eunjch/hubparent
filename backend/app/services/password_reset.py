"""비밀번호 재설정 — 2026-09-11 점검에서 추가.

자녀 계정이 이 서비스의 유일한 뿌리다. 부모님은 자녀 이름·전화번호로 들어오고,
마지막 자녀가 탈퇴하면 가족째 파기된다. 그래서 자녀가 비밀번호를 잊으면
**자녀도 부모님도 들어갈 방법이 없었다.** 복구 경로가 전혀 없었다.

토큰은 DB 에 두지 않고 서명된 JWT 로 만든다. 비밀번호 해시를 서명 재료에 섞어,
한 번 바꾸면 남은 링크가 자동으로 무효가 된다. 별도 폐기 목록이 필요 없다.
"""

import hashlib
import logging
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings
from app.models.user import User

log = logging.getLogger("hubfamily.password_reset")

TTL_MINUTES = 30
_PURPOSE = "password-reset"


def _fingerprint(user: User) -> str:
    """지금 비밀번호에서 뽑은 짧은 지문. 비밀번호가 바뀌면 달라진다."""
    return hashlib.sha256((user.password_hash or "").encode()).hexdigest()[:16]


def make_token(user: User) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": str(user.id),
            "purpose": _PURPOSE,
            "fp": _fingerprint(user),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=TTL_MINUTES)).timestamp()),
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )


def read_token(token: str) -> str:
    """토큰에서 사용자 id 를 꺼낸다. 형식·목적·만료가 맞지 않으면 예외."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    if payload.get("purpose") != _PURPOSE:
        raise jwt.InvalidTokenError("용도가 다른 토큰입니다.")
    return str(payload["sub"])


def token_matches(token: str, user: User) -> bool:
    """이미 비밀번호를 바꿨다면 예전 링크는 듣지 않는다."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return False
    return payload.get("fp") == _fingerprint(user)


def reset_url(token: str) -> str:
    base = settings.PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/reset?token={token}"


def compose(name: str, url: str) -> tuple[str, str, str]:
    """(제목, HTML, 텍스트). 링크 하나만 담는다 — 메일에서 할 일은 그것뿐이다."""
    subject = "허브패밀리 비밀번호 재설정"
    style = (
        "font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;"
        "line-height:1.7;color:#1c2b5c"
    )
    html = f"""<div style="{style}">
  <p>{name}님, 안녕하세요.</p>
  <p>비밀번호를 새로 정하시려면 아래 버튼을 눌러 주세요. <b>{TTL_MINUTES}분</b> 동안만 열립니다.</p>
  <p style="margin:24px 0">
    <a href="{url}" style="background:#2f4fb3;color:#fff;padding:14px 28px;border-radius:12px;
       text-decoration:none;font-weight:700;display:inline-block">비밀번호 새로 정하기</a>
  </p>
  <p style="color:#6b7299;font-size:.95rem">버튼이 눌리지 않으면 이 주소를 주소창에 넣어 주세요.<br>{url}</p>
  <p style="color:#6b7299;font-size:.95rem">직접 요청하지 않으셨다면 이 메일은 지우셔도 됩니다.
     비밀번호는 그대로입니다.</p>
</div>"""
    text = (
        f"{name}님, 안녕하세요.\n\n"
        f"비밀번호를 새로 정하시려면 아래 주소로 들어와 주세요. {TTL_MINUTES}분 동안만 열립니다.\n"
        f"{url}\n\n"
        "직접 요청하지 않으셨다면 이 메일은 지우셔도 됩니다."
    )
    return subject, html, text
