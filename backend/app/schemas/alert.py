"""이상 징후 알림 — 화면 G2."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import AlertSeverity, AlertType


class AlertOut(BaseModel):
    id: uuid.UUID
    target_user_id: uuid.UUID
    target_name: str
    type: AlertType
    severity: AlertSeverity
    message: str
    occurred_at: datetime
    ack_at: datetime | None


class AlertListOut(BaseModel):
    items: list[AlertOut]
    unread: int


class AckAllIn(BaseModel):
    """비우면 내 가족 전체."""

    user_id: uuid.UUID | None = None
