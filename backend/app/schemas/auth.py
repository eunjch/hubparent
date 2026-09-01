import uuid

from pydantic import BaseModel, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel


class OTPRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=20, examples=["01012345678"])


class OTPRequestResult(BaseModel):
    sent: bool
    # dev 환경에서만 채워진다. 운영에서는 항상 None.
    dev_code: str | None = None


class OTPVerify(BaseModel):
    phone: str = Field(min_length=10, max_length=20)
    code: str = Field(min_length=4, max_length=8)
    # 신규 가입일 때만 사용한다
    name: str | None = Field(default=None, max_length=50)
    role: UserRole | None = None
    birth_year: int | None = Field(default=None, ge=1900, le=2030)


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
    role: UserRole
    birth_year: int | None


class MeOut(BaseModel):
    user: UserOut
    family_id: uuid.UUID | None
    family_name: str | None
    consented: bool
