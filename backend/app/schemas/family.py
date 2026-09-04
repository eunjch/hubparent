import uuid

from pydantic import BaseModel, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel


class SeniorCreate(BaseModel):
    """자녀가 부모님을 등록한다. 어르신은 아무것도 입력하지 않는다 — 계획서 1.4."""

    name: str = Field(min_length=1, max_length=50, examples=["김영희"])
    phone: str = Field(min_length=10, max_length=20, examples=["010-8765-4321"])
    relation: str | None = Field(default=None, max_length=20, examples=["어머니"])
    birth_year: int | None = Field(default=None, ge=1900, le=2030)


class SeniorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    relation: str | None = Field(default=None, max_length=20)


class SeniorOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    relation: str | None
    birth_year: int | None
    # 한 번이라도 앱에 들어온 적이 있는지. 자녀가 "아직 안 들어오셨네" 를 알 수 있다.
    joined: bool


class FamilyOut(ORMModel):
    id: uuid.UUID
    name: str


class MemberOut(BaseModel):
    user_id: uuid.UUID
    name: str
    role: UserRole
    relation: str | None
