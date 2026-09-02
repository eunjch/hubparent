import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel


class AuthStart(BaseModel):
    """MVP 로그인·가입. 본인인증 없음 — 계획서 1.4.

    실사용자를 받기 전에 반드시 인증을 붙인다. 교체 지점은 이 엔드포인트 하나다.
    """

    phone: str = Field(min_length=10, max_length=20, examples=["01012345678"])
    name: str = Field(min_length=1, max_length=50)
    role: UserRole = UserRole.GUARDIAN
    email: EmailStr | None = None
    birth_year: int | None = Field(default=None, ge=1900, le=2030)
    # 건강정보 수집·이용 및 가족 간 공유 (필수)
    agree_health_data: bool = False
    # 일일 리포트 메일 수신 (선택)
    agree_email_report: bool = False


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(ORMModel):
    id: uuid.UUID
    phone: str
    name: str
    email: str | None
    role: UserRole
    birth_year: int | None


class MeOut(BaseModel):
    user: UserOut
    family_id: uuid.UUID | None
    family_name: str | None
    consented: bool
