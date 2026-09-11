import uuid

from pydantic import BaseModel, Field

from app.models.enums import UserRole
from app.schemas.auth import Phone
from app.schemas.common import ORMModel


class SeniorCreate(BaseModel):
    """자녀가 부모님을 등록한다. 어르신은 아무것도 입력하지 않는다 — 계획서 1.4."""

    name: str = Field(min_length=1, max_length=50, examples=["김영희"])
    # 자녀 가입에만 붙여 뒀는데, "----------" 같은 값이 실제로 들어오던 경로는 이쪽이었다
    # (2026-09-11 재점검). 빈 문자열 phone 이 하나 생기면 이후 모든 무의미 입력이
    # 그 계정과 충돌해 엉뚱한 안내가 나간다.
    phone: Phone = Field(examples=["010-8765-4321"])
    relation: str | None = Field(default=None, max_length=20, examples=["어머니"])
    birth_year: int | None = Field(default=None, ge=1900, le=2030)


class SeniorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    phone: str | None = Field(default=None, min_length=10, max_length=20)
    relation: str | None = Field(default=None, max_length=20)
    birth_year: int | None = Field(default=None, ge=1900, le=2030)


class SeniorOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    relation: str | None
    birth_year: int | None
    # 한 번이라도 앱에 들어온 적이 있는지. 자녀가 "아직 안 들어오셨네" 를 알 수 있다.
    joined: bool
    # 알림 권한 상태. None = 아직 모름(앱에 안 들어왔거나 옛 버전)
    notifications_granted: bool | None = None


class FamilyOut(ORMModel):
    id: uuid.UUID
    name: str


class MemberOut(BaseModel):
    user_id: uuid.UUID
    name: str
    phone: str  # 어르신 화면의 `자녀에게 전화하기` 가 쓴다
    role: UserRole
    relation: str | None
