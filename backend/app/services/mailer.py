"""메일 발송 — 네이버웍스 SMTP.

제약: 네이버웍스는 인증 계정 주소로만 발신할 수 있다.
      From 을 사용자 주소로 바꿔 보내면 거부된다.
      대신 표시 이름을 바꾸고, 답장은 Reply-To 로 받는다.

MVP 에서는 쓰지 않는다. M4 일일 리포트 메일에서 outbox 를 거쳐 호출된다.
지금 넣어 두는 이유는 서버에서 실제로 발송이 되는지 먼저 확인하기 위함이다
(공용 호스트라 외부 SMTP 가 막혀 있을 수 있다).
"""

import logging
import smtplib
import ssl
from email.header import Header
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import settings

log = logging.getLogger(__name__)


class MailNotConfigured(RuntimeError):
    pass


def send(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    reply_to: str | None = None,
) -> None:
    """한 통 보낸다. 실패하면 예외를 올린다 — 재시도는 호출부(outbox)가 판단한다."""
    if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
        raise MailNotConfigured("SMTP 설정이 없습니다. .env 의 SMTP_* 항목을 확인하세요.")

    msg = EmailMessage()
    msg["Subject"] = Header(subject, "utf-8")
    # 발신 주소는 인증 계정으로 고정. 표시 이름만 서비스명으로 바꾼다.
    msg["From"] = formataddr((str(Header(settings.MAIL_FROM_NAME, "utf-8")), settings.SMTP_USER))
    msg["To"] = to
    if reply_to:
        msg["Reply-To"] = reply_to

    msg.set_content(text or _strip_tags(html), subtype="plain", charset="utf-8")
    msg.add_alternative(html, subtype="html", charset="utf-8")

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=20) as smtp:
        smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)

    log.info("메일 발송 완료 to=%s subject=%s", to, subject)


def _strip_tags(html: str) -> str:
    """HTML 을 못 읽는 클라이언트를 위한 대체 텍스트."""
    import re

    text = re.sub(r"<br\s*/?>|</p>", "\n", html, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()
