"""시간 유틸.

저장은 항상 UTC 다 (계획서 5.2). 다만 DB 드라이버에 따라 읽어올 때
tzinfo 가 붙기도(PostgreSQL) 안 붙기도(테스트용 SQLite) 한다.

DB 에서 꺼낸 datetime 을 지금 시각과 비교할 때는 반드시 as_utc() 를 거친다.
안 그러면 "can't compare offset-naive and offset-aware datetimes" 로 터진다.
"""

from datetime import UTC, datetime


def now() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    """naive 면 UTC 로 간주해 aware 로 만든다."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def is_past(value: datetime) -> bool:
    """DB 에서 읽은 시각이 이미 지났는지."""
    return as_utc(value) < now()
