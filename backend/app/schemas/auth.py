import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel


class GuardianRegister(BaseModel):
    """자녀 회원가입. 이메일이 로그인 ID 다."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=10, max_length=20, examples=["010-1234-5678"])
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
