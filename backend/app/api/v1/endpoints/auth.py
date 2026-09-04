"""계정 · 토큰.

자녀는 일반 회원가입(이메일 + 비밀번호)으로 들어온다.
어르신은 자녀 이름 + 자녀 전화번호로 가족을 찾고 목록에서 본인을 고른다 — 계획서 1.4.

어르신에게 비밀번호를 만들게 하지 않는 것이 핵심이다. 본인인증이 붙기 전까지는
자녀 이름·번호를 아는 사람이 그 가족의 어르신 계정에 들어올 수 있다는 한계를
그대로 안고 간다. 교체 지점은 이 파일 하나다.
"""

from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession
from app.core.errors import Conflict, NotFound, Unauthorized
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    normalize_phone,
    verify_password,
)
from app.models.enums import ConsentKind, SubscriptionStatus, UserRole
from app.models.ops import Subscription
from app.models.user import Family, FamilyMember, User, UserConsent, UserSettings
from app.schemas.auth import (
    GuardianLogin,
    GuardianRegister,
    MeOut,
    RefreshRequest,
    SeniorChoice,
    SeniorLogin,
    SeniorLookup,
    SeniorLookupResult,
    TokenPair,
    UserOut,
)

router = APIRouter(tags=["auth"])

TRIAL_DAYS = 15  # 15일 무료체험 — 사업계획서 BM


def _tokens(user: User, is_new: bool = False) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        is_new_user=is_new,
    )


@router.post("/auth/register", response_model=TokenPair)
async def register(payload: GuardianRegister, session: DBSession) -> TokenPair:
    """자녀 회원가입. 가입과 동시에 가족이 만들어진다.

    부모님은 가입 후 별도로 등록한다 (자녀 1명 : 부모 N명).
    """
    if not payload.agree_health_data:
        raise Conflict("CONSENT_REQUIRED", "건강정보 이용 동의가 필요합니다.")

    email = payload.email.lower()
    if await session.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise Conflict("EMAIL_TAKEN", "이미 가입된 이메일입니다.")

    phone = normalize_phone(payload.phone)
    if await session.scalar(select(User.id).where(User.phone == phone)):
        raise Conflict("PHONE_TAKEN", "이미 가입된 연락처입니다.")

    now = datetime.now(UTC)
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        name=payload.name.strip(),
        phone=phone,
        role=UserRole.GUARDIAN,
        consented_at=now,
    )
    session.add(user)
    await session.flush()

    session.add_all(
        [
            UserSettings(user_id=user.id),
            UserConsent(user_id=user.id, kind=ConsentKind.HEALTH_DATA, granted_at=now),
        ]
    )
    if payload.agree_email_report:
        session.add(
            UserConsent(user_id=user.id, kind=ConsentKind.EMAIL_REPORT, granted_at=now)
        )

    family = Family(name=f"{user.name}님의 가족", created_by=user.id)
    session.add(family)
    await session.flush()

    session.add_all(
        [
            FamilyMember(family_id=family.id, user_id=user.id, role=UserRole.GUARDIAN),
            Subscription(
                family_id=family.id,
                status=SubscriptionStatus.TRIAL,
                trial_ends_at=now + timedelta(days=TRIAL_DAYS),
            ),
        ]
    )
    await session.flush()

    return _tokens(user, is_new=True)


@router.post("/auth/login", response_model=TokenPair)
async def login(payload: GuardianLogin, session: DBSession) -> TokenPair:
    user = await session.scalar(
        select(User).where(func.lower(User.email) == payload.email.lower())
    )
    # 이메일이 없는 경우와 비밀번호가 틀린 경우를 구분해 알려주지 않는다
    if user is None or not verify_password(payload.password, user.password_hash):
        raise Unauthorized("BAD_CREDENTIALS", "이메일 또는 비밀번호가 맞지 않습니다.")
    if not user.is_active:
        raise Unauthorized("USER_INACTIVE", "사용할 수 없는 계정입니다.")
    return _tokens(user)


async def _find_guardian(session: DBSession, name: str, phone: str) -> User:
    user = await session.scalar(
        select(User).where(
            User.phone == normalize_phone(phone),
            User.role == UserRole.GUARDIAN,
        )
    )
    if user is None or user.name.strip() != name.strip():
        raise NotFound("GUARDIAN_NOT_FOUND", "이름 또는 전화번호를 다시 확인해 주세요.")
    return user


async def _seniors_of(session: DBSession, guardian: User) -> tuple[Family | None, list[SeniorChoice]]:
    family_id = await session.scalar(
        select(FamilyMember.family_id).where(FamilyMember.user_id == guardian.id).limit(1)
    )
    if family_id is None:
        return None, []

    rows = await session.execute(
        select(User.id, User.name, FamilyMember.relation)
        .join(FamilyMember, FamilyMember.user_id == User.id)
        .where(FamilyMember.family_id == family_id, FamilyMember.role == UserRole.SENIOR)
        .order_by(FamilyMember.created_at)
    )
    family = await session.get(Family, family_id)
    return family, [SeniorChoice(id=r[0], name=r[1], relation=r[2]) for r in rows.all()]


@router.post("/auth/senior/lookup", response_model=SeniorLookupResult)
async def senior_lookup(payload: SeniorLookup, session: DBSession) -> SeniorLookupResult:
    """부모 로그인 1단계. 이름 외의 정보는 내보내지 않는다."""
    guardian = await _find_guardian(session, payload.guardian_name, payload.guardian_phone)
    family, seniors = await _seniors_of(session, guardian)
    if not seniors:
        raise NotFound("NO_SENIOR", "등록된 부모님이 없습니다. 자녀분께 확인해 주세요.")

    return SeniorLookupResult(
        family_name=family.name if family else "",
        guardian_name=guardian.name,
        seniors=seniors,
    )


@router.post("/auth/senior/login", response_model=TokenPair)
async def senior_login(payload: SeniorLogin, session: DBSession) -> TokenPair:
    """부모 로그인 2단계. 1단계 정보를 다시 검증하므로 senior_id 만으로는 못 들어온다."""
    guardian = await _find_guardian(session, payload.guardian_name, payload.guardian_phone)
    _, seniors = await _seniors_of(session, guardian)

    if payload.senior_id not in {s.id for s in seniors}:
        raise NotFound("SENIOR_NOT_FOUND", "다시 선택해 주세요.")

    senior = await session.get(User, payload.senior_id)
    if senior is None or not senior.is_active:
        raise NotFound("SENIOR_NOT_FOUND", "다시 선택해 주세요.")

    # 어르신 본인의 건강정보 동의는 첫 로그인 시점에 성립한다 — 계획서 11장
    if senior.consented_at is None:
        now = datetime.now(UTC)
        senior.consented_at = now
        session.add(UserConsent(user_id=senior.id, kind=ConsentKind.HEALTH_DATA, granted_at=now))
        await session.flush()

    return _tokens(senior)


@router.post("/auth/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, session: DBSession) -> TokenPair:
    try:
        user_id = decode_token(payload.refresh_token, expected_type="refresh")
    except jwt.InvalidTokenError as exc:
        raise Unauthorized("INVALID_TOKEN", "다시 시작해 주세요.") from exc

    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise Unauthorized("USER_NOT_FOUND", "다시 시작해 주세요.")
    return _tokens(user)


@router.get("/me", response_model=MeOut)
async def me(user: CurrentUser, session: DBSession) -> MeOut:
    row = (
        await session.execute(
            select(Family.id, Family.name)
            .join(FamilyMember, FamilyMember.family_id == Family.id)
            .where(FamilyMember.user_id == user.id)
            .limit(1)
        )
    ).first()

    return MeOut(
        user=UserOut.model_validate(user),
        family_id=row[0] if row else None,
        family_name=row[1] if row else None,
        consented=user.consented_at is not None,
    )
