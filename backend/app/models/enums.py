"""도메인 열거형. DB 에는 문자열 값으로 저장된다."""

from enum import StrEnum


class UserRole(StrEnum):
    SENIOR = "senior"       # 어르신 — 실사용자
    GUARDIAN = "guardian"   # 보호자 — 자녀, 결제자


class CheckSlot(StrEnum):
    """식사·기분 체크의 3시점."""

    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"


class MealStatus(StrEnum):
    ATE = "ate"             # 먹었어요
    SKIPPED = "skipped"     # 안 먹었어요


class MoodValue(StrEnum):
    GOOD = "good"           # 😊
    NORMAL = "normal"       # 😐
    BAD = "bad"             # 😟


class MedicationStatus(StrEnum):
    PENDING = "pending"     # 알림 발송 후 응답 대기
    TAKEN = "taken"         # 복용했어요
    MISSED = "missed"       # 당일 마감까지 미응답 (L3)


class ScheduleKind(StrEnum):
    HOSPITAL = "hospital"   # 병원 일정 — 자녀가 등록
    OTHER = "other"         # 기타 일정


class AlertType(StrEnum):
    NO_RESPONSE = "no_response"       # 생존신호 24시간 미수신
    NO_CHECKS = "no_checks"           # 하루 체크 3종 전부 미입력
    MISSED_MEDICATION = "missed_med"  # 복약 누락


class AlertSeverity(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ActivityLevel(StrEnum):
    HIGH = "high"           # 상
    NORMAL = "normal"       # 중
    LOW = "low"             # 하


class SubscriptionStatus(StrEnum):
    TRIAL = "trial"         # 15일 무료체험
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELED = "canceled"


class DevicePlatform(StrEnum):
    ANDROID = "android"
    IOS = "ios"
