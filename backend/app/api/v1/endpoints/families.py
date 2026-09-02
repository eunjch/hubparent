"""가족 생성 · 초대 · 합류.

온보딩은 자녀가 주도한다 (계획서 1.2). 자녀가 가족을 만들 때 부모님 계정까지
함께 만들고 초대코드를 받는다. 어르신은 그 코드만 입력하면 들어온다 —
어르신 쪽 입력을 0으로 만드는 것이 이 설계의 목적이다.
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession, require_guardian
from app.core.errors import Conflict, Forbidden, NotFound
from app.core.security import create_access_token, create_refresh_token
from app.core.timeutil import is_past
from app.models.enums import ConsentKind, SubscriptionStatus, UserRole
from app.models.ops import Subscription
from app.models.user import Family, FamilyMember, Invitation, User, UserConsent, UserSettings
from app.schemas.auth import TokenPair
from app.schemas.family import (
    FamilyCreate,
    FamilyCreated,
    FamilyOut,
    InvitationOut,
    InvitationPreview,
    MemberOut,
)

router = APIRouter(tags=["families"])

INVITE_TTL_DAYS = 7
TRIAL_DAYS = 15  # 15일 무료체험 — 사업계획서 BM

# 어르신이 불러주거나 눌러 넣기 쉬운 길이. 혼동되는 글자(0/O, 1/I)는 뺀다.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6


def _new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


async def _issue_code(session: DBSession) -> str:
    """충돌하면 다시 뽑는다."""
    for _ in range(10):
        code = _new_code()
        if await session.scalar(select(Invitation.id).where(Invitation.code == code)) is None:
            return code
    raise Conflict("CODE_GENERATION_FAILED", "잠시 후 다시 시도해 주세요.")


@router.post("/families", response_model=FamilyCreated, dependencies=[Depends(require_guardian)])
async def create_family(
    payload: FamilyCreate, user: CurrentUser, session: DBSession
) -> FamilyCreated:
    if await session.scalar(select(FamilyMember).where(FamilyMember.user_id == user.id)):
        raise Conflict("FAMILY_EXISTS", "이미 가족이 있습니다.")

    # 부모님 계정. 이미 다른 가족에 속해 있으면 막는다.
    senior = await session.scalar(select(User).where(User.phone == payload.senior_phone))
    if senior is not None:
        if await session.scalar(select(FamilyMember).where(FamilyMember.user_id == senior.id)):
            raise Conflict("SENIOR_ALREADY_JOINED", "이미 다른 가족에 등록된 번호입니다.")
    else:
        senior = User(
            phone=payload.senior_phone,
            name=payload.senior_name,
            role=UserRole.SENIOR,
            birth_year=payload.senior_birth_year,
            # 어르신 본인 동의는 합류 시점에 받는다 (claim 참고)
            consented_at=None,
        )
        session.add(senior)
        await session.flush()
        session.add(UserSettings(user_id=senior.id))

    family = Family(name=payload.name, created_by=user.id)
    session.add(family)
    await session.flush()

    session.add_all(
        [
            FamilyMember(family_id=family.id, user_id=user.id, role=UserRole.GUARDIAN),
            FamilyMember(
                family_id=family.id,
                user_id=senior.id,
                role=UserRole.SENIOR,
                relation=payload.relation,
            ),
            Subscription(
                family_id=family.id,
                status=SubscriptionStatus.TRIAL,
                trial_ends_at=datetime.now(UTC) + timedelta(days=TRIAL_DAYS),
            ),
        ]
    )

    invitation = Invitation(
        code=await _issue_code(session),
        family_id=family.id,
        target_role=UserRole.SENIOR,
        target_user_id=senior.id,
        expires_at=datetime.now(UTC) + timedelta(days=INVITE_TTL_DAYS),
    )
    session.add(invitation)
    await session.flush()

    return FamilyCreated(
        family=FamilyOut.model_validate(family),
        senior_id=senior.id,
        invitation_code=invitation.code,
        invitation_expires_at=invitation.expires_at,
    )


@router.post(
    "/families/{family_id}/invitations",
    response_model=InvitationOut,
    dependencies=[Depends(require_guardian)],
)
async def reissue_invitation(
    family_id: uuid.UUID, user: CurrentUser, session: DBSession
) -> InvitationOut:
    """코드를 잊었거나 만료됐을 때 다시 발급한다."""
    member = await session.scalar(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id, FamilyMember.user_id == user.id
        )
    )
    if member is None:
        raise Forbidden("NOT_FAMILY_MEMBER", "이 가족의 구성원이 아닙니다.")

    senior_id = await session.scalar(
        select(FamilyMember.user_id).where(
            FamilyMember.family_id == family_id, FamilyMember.role == UserRole.SENIOR
        )
    )

    invitation = Invitation(
        code=await _issue_code(session),
        family_id=family_id,
        target_role=UserRole.SENIOR,
        target_user_id=senior_id,
        expires_at=datetime.now(UTC) + timedelta(days=INVITE_TTL_DAYS),
    )
    session.add(invitation)
    await session.flush()
    return InvitationOut.model_validate(invitation)


@router.get("/invitations/{code}", response_model=InvitationPreview)
async def preview_invitation(code: str, session: DBSession) -> InvitationPreview:
    """어르신에게 "김영희 님 맞으세요?" 를 보여주기 위한 조회.

    인증 없이 열리므로 이름 외의 정보는 내보내지 않는다.
    """
    invitation = await session.scalar(select(Invitation).where(Invitation.code == code.upper()))
    if invitation is None or invitation.target_user_id is None:
        raise NotFound("INVITE_NOT_FOUND", "번호를 다시 확인해 주세요.")

    family = await session.get(Family, invitation.family_id)
    target = await session.get(User, invitation.target_user_id)

    return InvitationPreview(
        family_name=family.name if family else "",
        target_name=target.name if target else "",
        expired=is_past(invitation.expires_at),
        used=invitation.used_at is not None,
    )


@router.post("/invitations/{code}/claim", response_model=TokenPair)
async def claim_invitation(code: str, session: DBSession) -> TokenPair:
    """어르신이 코드로 합류하고 바로 토큰을 받는다.

    로그인하지 않은 상태에서 호출되므로 인증을 요구하지 않는다.
    코드 자체가 인증 수단이다 — 계획서 1.4 의 제약을 그대로 안고 간다.
    """
    invitation = await session.scalar(select(Invitation).where(Invitation.code == code.upper()))
    if invitation is None or invitation.target_user_id is None:
        raise NotFound("INVITE_NOT_FOUND", "번호를 다시 확인해 주세요.")
    if invitation.used_at is not None:
        raise Conflict("INVITE_USED", "이미 사용된 번호입니다.")
    if is_past(invitation.expires_at):
        raise Conflict("INVITE_EXPIRED", "기간이 지난 번호입니다. 자녀분께 다시 요청해 주세요.")

    senior = await session.get(User, invitation.target_user_id)
    if senior is None or not senior.is_active:
        raise NotFound("USER_NOT_FOUND", "번호를 다시 확인해 주세요.")

    now = datetime.now(UTC)
    invitation.used_at = now
    invitation.used_by = senior.id

    # 어르신 본인의 건강정보 동의는 이 시점에 성립한다 — 계획서 11장
    if senior.consented_at is None:
        senior.consented_at = now
        session.add(UserConsent(user_id=senior.id, kind=ConsentKind.HEALTH_DATA, granted_at=now))
    await session.flush()

    return TokenPair(
        access_token=create_access_token(senior.id),
        refresh_token=create_refresh_token(senior.id),
    )


@router.get("/families/{family_id}/members", response_model=list[MemberOut])
async def list_members(
    family_id: uuid.UUID, user: CurrentUser, session: DBSession
) -> list[MemberOut]:
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
    return [MemberOut(user_id=r[0], name=r[1], role=r[2], relation=r[3]) for r in rows.all()]
