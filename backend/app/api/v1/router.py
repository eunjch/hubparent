from fastapi import APIRouter

from app.api.v1.endpoints import (
    alerts,
    auth,
    checks,
    devices,
    families,
    medications,
    notifications,
    profile,
    reports,
    schedules,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(families.router)
api_router.include_router(devices.router)
api_router.include_router(checks.router)
api_router.include_router(medications.router)
api_router.include_router(schedules.router)
api_router.include_router(profile.router)
api_router.include_router(notifications.router)
api_router.include_router(reports.router)
api_router.include_router(alerts.router)
