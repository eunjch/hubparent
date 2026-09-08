"""리포트 — 화면 G1 (오늘 요약 · 7일 추이 · 활동량)."""

import uuid
from datetime import date

from pydantic import BaseModel

from app.models.enums import ActivityLevel, CheckSlot, MoodValue


class MoodEntry(BaseModel):
    slot: CheckSlot
    mood: MoodValue


class TrendPoint(BaseModel):
    date: date
    score: int


class FamilyReportOut(BaseModel):
    user_id: uuid.UUID
    report_date: date
    score: int
    meal_done: int
    meal_total: int = 3
    med_taken: int
    med_total: int
    moods: list[MoodEntry]
    # 신호가 없으면 None — "기록 없음" 으로 보여 준다
    activity_level: ActivityLevel | None
    steps: int
    summary_text: str
    trend: list[TrendPoint]
    # 확인 안 한 알림 수. 벨의 점이 이걸 본다
    unread_alerts: int


class HourBucket(BaseModel):
    hour: int
    steps: int
    screen_on: int


class ActivityReportOut(BaseModel):
    user_id: uuid.UUID
    report_date: date
    activity_level: ActivityLevel | None
    steps: int
    hours: list[HourBucket]
