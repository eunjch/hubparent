"""메일 발송 확인용.

    docker compose exec -T api python scripts/send_test_mail.py 받는사람@example.com

공용 호스트라 외부 SMTP(465)가 막혀 있을 수 있어, M4 전에 미리 확인한다.
"""

import sys

from app.core.config import settings
from app.services import mailer


def main() -> int:
    if len(sys.argv) < 2:
        print("사용법: python scripts/send_test_mail.py 받는사람@example.com")
        return 1

    to = sys.argv[1]
    print(f"SMTP  : {settings.SMTP_HOST}:{settings.SMTP_PORT}")
    print(f"계정  : {settings.SMTP_USER or '(미설정)'}")
    print(f"받는이: {to}")

    try:
        mailer.send(
            to=to,
            subject="[HUB FAMILY] 메일 발송 테스트",
            html=(
                "<p>HUB FAMILY 메일 발송 테스트입니다.</p>"
                "<p>이 메일이 도착했다면 서버에서 외부 SMTP 발송이 가능합니다.</p>"
            ),
        )
    except Exception as exc:  # noqa: BLE001 - 원인을 그대로 보여주는 게 목적
        print(f"\n실패: {type(exc).__name__}: {exc}")
        print("\n확인할 것:")
        print("  - .env 의 SMTP_USER / SMTP_PASSWORD")
        print("  - 서버 방화벽에서 465 아웃바운드 허용 여부")
        print("  - 네이버웍스 계정의 SMTP 사용 설정")
        return 1

    print("\n성공 — 받은편지함(스팸함 포함)을 확인하세요.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
