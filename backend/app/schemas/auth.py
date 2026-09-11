import uuid
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field

from app.core.security import valid_phone
from app.models.enums import UserRole
from app.schemas.common import ORMModel


def _phone(v: str) -> str:
    if not valid_phone(v):
        raise ValueError("휴대전화 번호 형식이 아닙니다.")
    return v


Phone = Annotated[str, Field(min_length=10, max_length=20), AfterValidator(_phone)]


class GuardianRegister(BaseModel):
    """자녀 회원가입. 이메일이 로그인 ID 다."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: str = Field(min_length=1, max_length=50)
    phone: Phone = Field(examples=["010-1234-5678"])
    # 건강정보 수집·이용 및 가족 간 공유 (필수)
    agree_health_data: bool = False
    # 일일 리포트 메일 수신 (선택)
    agree_email_report: bool = False


class GuardianLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class SeniorLookup(BaseModel):
    """부모 로그인 1단계 — 자녀 이름과 자녀 전화번호로 가족을 찾는다.

    어르신이 확실히 아는 정보만 묻는다. 본인 번호는 기억이 흐릴 수 있지만
    자녀 이름과 번호는 대개 외우고 있거나 전화기에 있다 (계획서 1.4).
    """

    guardian_name: str = Field(min_length=1, max_length=50)
    guardian_phone: str = Field(min_length=10, max_length=20)


class SeniorChoice(ORMModel):
    id: uuid.UUID
    name: str
    relation: str | None


class SeniorLookupResult(BaseModel):
    family_name: str
    guardian_name: str
    seniors: list[SeniorChoice]


class SeniorLogin(SeniorLookup):
    """부모 로그인 2단계 — 목록에서 본인을 고른다.

    1단계 정보를 다시 받아 관계를 재검증한다. senior_id 만으로는 들어올 수 없다.
    """

    senior_id: uuid.UUID


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


class WithdrawRequest(BaseModel):
    """탈퇴 요청. confirm 은 사고로 부르는 것을 막는 잠금이다."""

    confirm: bool = False
    password: str | None = None  # 자녀만. 어르신은 비밀번호가 없다


class WithdrawResult(BaseModel):
    """무엇이 지워졌는지. 화면이 안내 문구를 고르는 데 쓴다."""

    scope: str  # "user" = 본인만 · "family" = 가족 전체
    deleted_users: int


class PasswordResetRequest(BaseModel):
    """비밀번호 재설정 메일 요청. 가입 여부는 응답으로 알려주지 않는다."""

    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=10, max_length=2048)
    password: str = Field(min_length=8, max_length=72)
