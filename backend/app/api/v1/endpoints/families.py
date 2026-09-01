"""가족 생성 · 초대.

결제자(자녀)와 사용자(어르신)가 분리되므로 온보딩은 자녀가 주도한다 — 계획서 1.2.
자녀가 가족을 만들고 초대코드를 발급하면, 어르신은 코드만 입력해 합류한다.
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession, require_guardian
from app.core.errors import Conflict, Forbidden, NotFound
from app.models.enums import SubscriptionStatus, UserRole
from app.models.ops import Subscription
from app.models.user import Family, FamilyMember, Invitation, User, UserSettings
from app.schemas.family import FamilyCreate, FamilyOut, InvitationCreate, InvitationOut, MemberOut

router = APIRouter(tags=["families"])

INVITE_TTL_DAYS = 7
TRIAL_DAYS = 15  # 15일 무료체험 — 사업계획서 BM


@router.post("/families", response_model=FamilyOut, dependencies=[Depends(require_guardian)])
async def create_family(payload: FamilyCreate, user: CurrentUser, session: DBSession) -> FamilyOut:
    existing = await session.scalar(select(FamilyMember).where(FamilyMember.user_id == user.id))
    if existing is not None:
        raise Conflict("FAMILY_EXISTS", "이미 가족이 있습니다.")

    family = Family(name=payload.name, created_by=user.id)
    session.add(family)
    await session.flush()

    session.add(FamilyMember(family_id=family.id, user_id=user.id, role=user.role))
    session.add(
        Subscription(
            family_id=family.id,
            status=SubscriptionStatus.TRIAL,
            trial_ends_at=datetime.now(UTC) + timedelta(days=TRIAL_DAYS),
        )
    )
    await session.flush()
    return FamilyOut.model_validate(family)


@router.post(
    "/families/{family_id}/invitations",
    response_model=InvitationOut,
    dependencies=[Depends(require_guardian)],
)
async def create_invitation(
    family_id: uuid.UUID, payload: InvitationCreate, user: CurrentUser, session: DBSession
) -> InvitationOut:
    member = await session.scalar(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id, FamilyMember.user_id == user.id
        )
    )
    if member is None:
        raise Forbidden("NOT_FAMILY_MEMBER", "이 가족의 구성원이 아닙니다.")

    invitation = Invitation(
        code=secrets.token_hex(3).upper(),  # 6자리. 어르신이 불러주기 쉬운 길이
        family_id=family_id,
        target_role=payload.target_role,
        expires_at=datetime.now(UTC) + timedelta(days=INVITE_TTL_DAYS),
    )
    session.add(invitation)
    await session.flush()
    return InvitationOut.model_validate(invitation)


@router.post("/invitations/{code}/accept", response_model=FamilyOut)
async def accept_invitation(code: str, user: CurrentUser, session: DBSession) -> FamilyOut:
    invitation = await session.scalar(select(Invitation).where(Invitation.code == code.upper()))
    if invitation is None:
        raise NotFound("INVITE_NOT_FOUND", "초대코드를 찾을 수 없습니다.")
    if invitation.used_at is not None:
        raise Conflict("INVITE_USED", "이미 사용된 초대코드입니다.")
    if invitation.expires_at < datetime.now(UTC):
        raise Conflict("INVITE_EXPIRED", "기간이 지난 초대코드입니다.")

    already = await session.scalar(
        select(FamilyMember).where(
            FamilyMember.family_id == invitation.family_id, FamilyMember.user_id == user.id
        )
    )
    if already is None:
        session.add(
            FamilyMember(family_id=invitation.family_id, user_id=user.id, role=user.role)
        )

    invitation.used_at = datetime.now(UTC)
    invitation.used_by = user.id

    if user.role is UserRole.SENIOR:
        settings_row = await session.scalar(
            select(UserSettings).where(UserSettings.user_id == user.id)
        )
        if settings_row is None:
            session.add(UserSettings(user_id=user.id))

    await session.flush()
    family = await session.get(Family, invitation.family_id)
    return FamilyOut.model_validate(family)


@router.get("/families/{family_id}/members", response_model=list[MemberOut])
async def list_members(family_id: uuid.UUID, user: CurrentUser, session: DBSession) -> list[MemberOut]:
    member = await session.scalar(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id, FamilyMember.user_id == user.id
        )
    )
    if member is None:
        raise Forbidden("NOT_FAMILY_MEMBER", "이 가족의 구성원이 아닙니다.")

    rows = await session.execute(
        select(User.id, User.name, FamilyMember.role, FamilyMember.relation)
        .join(FamilyMember, FamilyMember.user_id == User.id)
        .where(FamilyMember.family_id == family_id)
    )
    return [
        MemberOut(user_id=r[0], name=r[1], role=r[2], relation=r[3]) for r in rows.all()
    ]
