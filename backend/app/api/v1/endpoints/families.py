"""가족 · 부모님 관리.

자녀 1명이 부모님 여러 명을 관리한다 (1:N). 가족은 회원가입 시 자동으로 만들어지고,
부모님은 여기서 추가·수정·삭제한다.

어르신 계정은 자녀가 만든다. 어르신은 자녀 이름·번호로 들어와 목록에서 본인을
고르기만 한다 — 어르신 쪽 입력을 0으로 두는 것이 이 설계의 목적이다 (계획서 1.4).
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession, require_guardian
from app.core.errors import Conflict, NotFound
from app.core.security import normalize_phone
from app.models.enums import UserRole
from app.models.user import Family, FamilyMember, User, UserSettings
from app.schemas.family import FamilyOut, MemberOut, SeniorCreate, SeniorOut, SeniorUpdate

router = APIRouter(tags=["family"])


async def _my_family_id(session: DBSession, user: User) -> uuid.UUID:
    family_id = await session.scalar(
        select(FamilyMember.family_id).where(FamilyMember.user_id == user.id).limit(1)
    )
    if family_id is None:
        raise NotFound("NO_FAMILY", "가족 정보를 찾을 수 없습니다.")
    return family_id


async def _senior_rows(session: DBSession, family_id: uuid.UUID) -> list[SeniorOut]:
    rows = await session.execute(
        select(User, FamilyMember.relation)
        .join(FamilyMember, FamilyMember.user_id == User.id)
        .where(FamilyMember.family_id == family_id, FamilyMember.role == UserRole.SENIOR)
        .order_by(FamilyMember.created_at)
    )
    return [
        SeniorOut(
            id=u.id,
            name=u.name,
            phone=u.phone,
            relation=relation,
            birth_year=u.birth_year,
            joined=u.consented_at is not None,
        )
        for u, relation in rows.all()
    ]


@router.get("/family", response_model=FamilyOut)
async def my_family(user: CurrentUser, session: DBSession) -> FamilyOut:
    family = await session.get(Family, await _my_family_id(session, user))
    if family is None:
        raise NotFound("NO_FAMILY", "가족 정보를 찾을 수 없습니다.")
    return FamilyOut.model_validate(family)


@router.get("/family/seniors", response_model=list[SeniorOut])
async def list_seniors(user: CurrentUser, session: DBSession) -> list[SeniorOut]:
    return await _senior_rows(session, await _my_family_id(session, user))


@router.post("/family/seniors", response_model=SeniorOut, dependencies=[Depends(require_guardian)])
async def add_senior(payload: SeniorCreate, user: CurrentUser, session: DBSession) -> SeniorOut:
    family_id = await _my_family_id(session, user)
    phone = normalize_phone(payload.phone)

    senior = await session.scalar(select(User).where(User.phone == phone))
    if senior is not None:
        if await session.scalar(select(FamilyMember).where(FamilyMember.user_id == senior.id)):
            raise Conflict("SENIOR_ALREADY_JOINED", "이미 다른 가족에 등록된 번호입니다.")
    else:
        senior = User(
            phone=phone,
            name=payload.name.strip(),
            role=UserRole.SENIOR,
            birth_year=payload.birth_year,
            # 어르신 본인 동의는 첫 로그인 시점에 받는다 (auth.senior_login 참고)
            consented_at=None,
        )
        session.add(senior)
        await session.flush()
        session.add(UserSettings(user_id=senior.id))

    session.add(
        FamilyMember(
            family_id=family_id,
            user_id=senior.id,
            role=UserRole.SENIOR,
            relation=payload.relation,
        )
    )
    await session.flush()

    return SeniorOut(
        id=senior.id,
        name=senior.name,
        phone=senior.phone,
        relation=payload.relation,
        birth_year=senior.birth_year,
        joined=senior.consented_at is not None,
    )


@router.patch(
    "/family/seniors/{senior_id}", response_model=SeniorOut, dependencies=[Depends(require_guardian)]
)
async def update_senior(
    senior_id: uuid.UUID, payload: SeniorUpdate, user: CurrentUser, session: DBSession
) -> SeniorOut:
    family_id = await _my_family_id(session, user)
    member = await session.scalar(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id,
            FamilyMember.user_id == senior_id,
            FamilyMember.role == UserRole.SENIOR,
        )
    )
    if member is None:
        raise NotFound("SENIOR_NOT_FOUND", "부모님을 찾을 수 없습니다.")

    senior = await session.get(User, senior_id)
    if senior is None:
        raise NotFound("SENIOR_NOT_FOUND", "부모님을 찾을 수 없습니다.")

    if payload.name is not None:
        senior.name = payload.name.strip()
    if payload.relation is not None:
        member.relation = payload.relation
    await session.flush()

    return SeniorOut(
        id=senior.id,
        name=senior.name,
        phone=senior.phone,
        relation=member.relation,
        birth_year=senior.birth_year,
        joined=senior.consented_at is not None,
    )


@router.delete("/family/seniors/{senior_id}", dependencies=[Depends(require_guardian)])
async def remove_senior(senior_id: uuid.UUID, user: CurrentUser, session: DBSession) -> dict:
    """가족에서 제외한다. 어르신 계정과 기록 자체는 남긴다 —
    실수로 지웠을 때 되돌릴 수 있어야 하고, 파기는 별도 절차다 (계획서 11장)."""
    family_id = await _my_family_id(session, user)
    member = await session.scalar(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id,
            FamilyMember.user_id == senior_id,
            FamilyMember.role == UserRole.SENIOR,
        )
    )
    if member is None:
        raise NotFound("SENIOR_NOT_FOUND", "부모님을 찾을 수 없습니다.")

    await session.delete(member)
    return {"ok": True}


@router.get("/family/members", response_model=list[MemberOut])
async def list_members(user: CurrentUser, session: DBSession) -> list[MemberOut]:
    family_id = await _my_family_id(session, user)
    rows = await session.execute(
        select(User.id, User.name, FamilyMember.role, FamilyMember.relation)
        .join(FamilyMember, FamilyMember.user_id == User.id)
        .where(FamilyMember.family_id == family_id)
    )
    return [MemberOut(user_id=r[0], name=r[1], role=r[2], relation=r[3]) for r in rows.all()]

