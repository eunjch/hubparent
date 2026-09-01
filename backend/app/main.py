from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import AppError, app_error_handler, http_error_handler

# Capacitor 웹뷰가 보내는 Origin.
#  - Android: https://localhost (기본 스킴)
#  - iOS: capacitor://localhost
# 웹앱 번들이 앱 안에 동봉되므로 브라우저 도메인은 개발용만 열어 둔다.
ALLOWED_ORIGINS = [
    "https://localhost",
    "capacitor://localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
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

app.include_router(api_router)


@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.ENV}
