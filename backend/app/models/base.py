"""공통 Base 와 믹스인.

시간은 전부 UTC 로 저장한다. 표시(KST)와 복약 스케줄 계산에서만 변환한다 — 계획서 5.2.
"""

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Uuid, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDPKMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


def enum_column(enum_cls: type[enum.Enum], **kwargs: Any) -> Any:
    """열거형 컬럼.

    그냥 String 으로 두면 DB 에서 읽어온 값이 str 로 돌아와 `is` 비교가 깨진다.
    (권한 검증이 조용히 실패하는 원인이 된다.)
    native_enum=False 로 VARCHAR + CHECK 제약을 쓰고, name 이 아닌 value 를 저장한다.
    """
    return mapped_column(
        SAEnum(
            enum_cls,
            native_enum=False,
            length=20,
            values_callable=lambda e: [m.value for m in e],
        ),
        **kwargs,
    )
