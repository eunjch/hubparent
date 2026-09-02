import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel


class FamilyCreate(BaseModel):
    """자녀가 가족을 만들면서 부모님 계정까지 함께 만든다 — 계획서 1.4.

    어르신은 아무것도 입력하지 않으므로, 성함과 연락처를 자녀가 등록한다.
    응답으로 초대코드가 바로 나온다 (화면 G1 → G2 가 한 번의 호출로 끝난다).
    """

    name: str = Field(max_length=50, examples=["김영희 가족"])
    senior_name: str = Field(max_length=50, examples=["김영희"])
    senior_phone: str = Field(min_length=10, max_length=20, examples=["01033334444"])
    senior_birth_year: int | None = Field(default=None, ge=1900, le=2030)
    relation: str | None = Field(default=None, max_length=20, examples=["어머니"])


class FamilyOut(ORMModel):
    id: uuid.UUID
    name: str


class FamilyCreated(BaseModel):
    family: FamilyOut
    senior_id: uuid.UUID
    invitation_code: str
    invitation_expires_at: datetime


class InvitationOut(ORMModel):
    code: str
    expires_at: datetime


class InvitationPreview(BaseModel):
    """어르신이 코드를 넣었을 때 "김영희 님 맞으세요?" 를 띄우기 위한 정보.

    인증 없이 열리는 엔드포인트라 이름 외의 정보는 주지 않는다.
    """

    family_name: str
    target_name: str
    expired: bool
    used: bool


class MemberOut(BaseModel):
    user_id: uuid.UUID
    name: str
    role: UserRole
    relation: str | None
