"""모든 모델을 여기서 import 한다. alembic autogenerate 가 이 목록을 본다."""

from app.models.base import Base
from app.models.care import (
    MealCheck,
    Medication,
    MedicationLog,
    MoodCheck,
    Schedule,
)
from app.models.monitor import ActivitySignal, Alert, DailyReport
from app.models.notify import LocalNotification, NotificationLog
from app.models.ops import AuditLog, Subscription
from app.models.user import (
    Device,
    EmergencyContact,
    Family,
    FamilyMember,
    User,
    UserConsent,
    UserSettings,
)

__all__ = [
    "ActivitySignal",
    "Alert",
    "AuditLog",
    "Base",
    "DailyReport",
    "Device",
    "EmergencyContact",
    "Family",
    "FamilyMember",
    "LocalNotification",
    "MealCheck",
    "Medication",
    "MedicationLog",
    "MoodCheck",
    "NotificationLog",
    "Schedule",
    "Subscription",
    "User",
    "UserConsent",
    "UserSettings",
]
