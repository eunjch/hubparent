"""로컬 알림 계획 · 단말 보고 (계획서 8.5.5 · 8.5.11)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PlanItem(BaseModel):
    local_id: int
    at: datetime
    title: str
    body: str
    channel: str
    route: str


class PlanOut(BaseModel):
    items: list[PlanItem]
    revoked_ids: list[int]


class LocalEvent(BaseModel):
    local_id: int
    event: Literal["scheduled", "fired", "canceled"]
    at: datetime


class LocalReport(BaseModel):
    events: list[LocalEvent] = Field(max_length=500)
