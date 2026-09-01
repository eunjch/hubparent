"""에러 포맷 통일 — 계획서 6장 공통 규약.

    {"code": "MEAL_ALREADY_CHECKED", "message": "..."}
"""

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse


class AppError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message


class NotFound(AppError):
    def __init__(self, code: str = "NOT_FOUND", message: str = "찾을 수 없습니다.") -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, code, message)


class Forbidden(AppError):
    def __init__(self, code: str = "FORBIDDEN", message: str = "권한이 없습니다.") -> None:
        super().__init__(status.HTTP_403_FORBIDDEN, code, message)


class Unauthorized(AppError):
    def __init__(self, code: str = "UNAUTHORIZED", message: str = "다시 시작해 주세요.") -> None:
        super().__init__(status.HTTP_401_UNAUTHORIZED, code, message)


class Conflict(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(status.HTTP_409_CONFLICT, code, message)


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message})


async def http_error_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": "HTTP_ERROR", "message": str(exc.detail)},
    )
