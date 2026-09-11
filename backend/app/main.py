import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import (
    AppError,
    app_error_handler,
    http_error_handler,
    validation_error_handler,
)

# Capacitor 웹뷰가 보내는 Origin.
#  - Android: https://localhost (기본 스킴)
#  - iOS: capacitor://localhost
# 웹앱 번들이 앱 안에 동봉되므로 브라우저 도메인은 개발용만 열어 둔다.
ALLOWED_ORIGINS = [
    "https://localhost",
    "capacitor://localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(
    title="HUB FAMILY API",
    version="0.1.0",
    description="가족 안심 케어 플랫폼",
    lifespan=lifespan,
    docs_url=None if settings.is_prod else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_prod else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(HTTPException, http_error_handler)
# 검증 오류도 공통 규약으로. 없으면 앱이 "연결이 원활하지 않습니다" 로 잘못 안내한다
app.add_exception_handler(RequestValidationError, validation_error_handler)

app.include_router(api_router)

# 식사 사진. 운영에서는 아파치 Alias 가 /uploads/ 를 직접 낸다 (deploy/apache) —
# 여기서는 개발 편의로만 연다.
if not settings.is_prod:
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR, check_dir=False), name="uploads")


# 설정이 빠져 조용히 죽는 기능을 기동 때 한 번 알린다. 비밀번호 찾기는 자녀가 잠겼을 때
# 가족 전체의 유일한 복구 경로인데, SMTP 가 비어 있으면 화면에는 "보냈습니다" 가 뜨고
# 실제로는 아무 일도 안 일어난다 (2026-09-11 재점검).
_boot = logging.getLogger("hubfamily.boot")
if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
    _boot.warning("SMTP 미설정 — 비밀번호 재설정 메일이 나가지 않습니다 (.env 의 SMTP_* 확인)")
if not settings.PUBLIC_BASE_URL.rstrip("/").endswith(("co.kr", "localhost:5174")):
    _boot.warning(
        "PUBLIC_BASE_URL=%s — 재설정 메일의 링크가 이 주소로 만들어집니다. "
        "API 가 아니라 웹앱 주소여야 합니다.",
        settings.PUBLIC_BASE_URL,
    )


@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.ENV}
