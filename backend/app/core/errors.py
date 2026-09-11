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


class BadRequest(AppError):
    def __init__(self, code: str = "BAD_REQUEST", message: str = "요청이 올바르지 않습니다.") -> None:
        super().__init__(status.HTTP_400_BAD_REQUEST, code, message)


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


def _field_name(loc: tuple) -> str:
    """검증 오류 위치에서 사용자에게 보여 줄 항목 이름만 뽑는다."""
    parts = [str(p) for p in loc if p not in ("body", "query", "path")]
    return parts[-1] if parts else "입력값"


FIELD_LABEL = {
    "email": "이메일",
    "password": "비밀번호",
    "phone": "전화번호",
    "name": "이름",
    "times": "복용 시각",
    "check_date": "날짜",
    "birth_year": "출생연도",
}


async def validation_error_handler(_: Request, exc: Exception) -> JSONResponse:
    """입력 검증 실패를 공통 규약 {code, message} 로 바꾼다.

    기본 처리기는 {"detail": [...]} 를 내는데 웹앱이 그걸 못 읽어 **모든 입력 오류가
    "연결이 원활하지 않습니다" 로 보였다** (2026-09-11 점검). 사용자가 원인을 알 수 없었다.
    제출한 값(input)은 싣지 않는다 — 비밀번호가 그대로 돌아오던 문제도 함께 막는다.
    """
    errors = getattr(exc, "errors", lambda: [])()
    first = errors[0] if errors else {}
    field = _field_name(tuple(first.get("loc", ())))
    label = FIELD_LABEL.get(field, field)
    message = f"{label}을(를) 다시 확인해 주세요." if field != "입력값" else "입력값을 다시 확인해 주세요."
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"code": "VALIDATION_ERROR", "message": message, "field": field},
    )


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message})


async def http_error_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": "HTTP_ERROR", "message": str(exc.detail)},
    )
