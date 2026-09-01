from fastapi import APIRouter

from app.api.v1.endpoints import auth, checks, devices, families, profile

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(families.router)
api_router.include_router(devices.router)
api_router.include_router(checks.router)
api_router.include_router(profile.router)

# M2~M4 에서 추가된다 — 계획서 6장 API 표 참고
#   medications  (복약 스케줄 · 에스컬레이션)   → M3
#   schedules    (병원 일정)                    → M3
#   reports      (일일 리포트, 화면 6·7)        → M4
#   alerts       (이상 징후, 화면 8)            → M4
