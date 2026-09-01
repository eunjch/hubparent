import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel


class FamilyCreate(BaseModel):
    name: str = Field(max_length=50, examples=["김영희 가족"])


class FamilyOut(ORMModel):
    id: uuid.UUID
    name: str


class InvitationCreate(BaseModel):
    target_role: UserRole = UserRole.SENIOR
    relation: str | None = Field(default=None, max_length=20, examples=["어머니"])


class InvitationOut(ORMModel):
    code: str
    expires_at: datetime


class MemberOut(BaseModel):
    user_id: uuid.UUID
    name: str
    role: UserRole
    relation: str | None
