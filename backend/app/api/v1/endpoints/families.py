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
from app.models.user import Device, Family, FamilyMember, User, UserSettings
from app.schemas.family import FamilyOut, MemberOut, SeniorCreate, SeniorOut, SeniorUpdate
from app.services import account

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
    found = rows.all()

    # 알림을 꺼 둔 부모님을 자녀 화면에서도 알 수 있어야 한다 (계획서 8.5.8).
    # 단말이 여럿이면 **가장 최근에 쓴 것**을 본다. "하나라도 켜져 있으면 켜짐" 으로 보면
    # 안 쓰는 옛 폰이 지금 쓰는 폰의 꺼짐을 가린다 (2026-09-11 재점검).
    granted: dict[uuid.UUID, bool] = {}
    if found:
        ids = [u.id for u, _ in found]
        states = await session.execute(
            select(Device.user_id, Device.notifications_granted)
            .where(Device.user_id.in_(ids), Device.notifications_granted.is_not(None))
            .order_by(Device.last_seen_at)
        )
        for uid, ok in states.all():
            granted[uid] = ok   # 정렬 덕에 마지막으로 덮이는 값이 가장 최근 단말이다

    return [
        SeniorOut(
            id=u.id,
            name=u.name,
            phone=u.phone,
            relation=relation,
            birth_year=u.birth_year,
            joined=u.consented_at is not None,
            notifications_granted=granted.get(u.id),
        )
        for u, relation in found
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
        # 소속이 있든 없든 기존 계정은 데려오지 않는다. 예전에는 소속만 확인해서,
        # 가족에서 뺀 어르신의 번호를 남이 등록하면 과거 건강기록까지 딸려 갔다
        # (2026-09-11 점검). 본인 확인 수단이 생기기 전까지는 번호를 막는다.
        raise Conflict("SENIOR_ALREADY_JOINED", "이미 등록된 적이 있는 번호입니다.")
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
    if payload.birth_year is not None:
        senior.birth_year = payload.birth_year
    if payload.phone is not None:
        phone = normalize_phone(payload.phone)
        if phone != senior.phone:
            taken = await session.scalar(select(User.id).where(User.phone == phone, User.id != senior.id))
            if taken is not None:
                raise Conflict("PHONE_TAKEN", "이미 쓰고 있는 번호입니다.")
            senior.phone = phone
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
    """가족에서 제외하고 그 어르신의 계정·기록을 파기한다.

    예전에는 소속 행만 지우고 계정을 남겼는데, 남은 계정은 아무 자녀도 볼 수 없고
    본인도 다시 로그인할 수 없으면서 건강기록만 영구히 남았다. 게다가 그 번호를
    남이 등록하면 기록까지 가져갈 수 있었다 (2026-09-11 점검).
    개인정보처리방침의 "탈퇴 즉시 파기" 와도 이쪽이 맞다. 되돌릴 수 없으므로
    화면에서 무엇이 지워지는지 알리고 확인을 받는다.
    """
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
    await session.flush()
    await account.purge_user(session, senior_id)
    return {"ok": True}


@router.get("/family/members", response_model=list[MemberOut])
async def list_members(user: CurrentUser, session: DBSession) -> list[MemberOut]:
    family_id = await _my_family_id(session, user)
    rows = await session.execute(
        select(User.id, User.name, User.phone, FamilyMember.role, FamilyMember.relation)
        .join(FamilyMember, FamilyMember.user_id == User.id)
        .where(FamilyMember.family_id == family_id)
    )
    return [
        MemberOut(user_id=r[0], name=r[1], phone=r[2], role=r[3], relation=r[4]) for r in rows.all()
    ]

