"""계정 · 토큰.

자녀는 일반 회원가입(이메일 + 비밀번호)으로 들어온다.
어르신은 자녀 이름 + 자녀 전화번호로 가족을 찾고 목록에서 본인을 고른다 — 계획서 1.4.

어르신에게 비밀번호를 만들게 하지 않는 것이 핵심이다. 본인인증이 붙기 전까지는
자녀 이름·번호를 아는 사람이 그 가족의 어르신 계정에 들어올 수 있다는 한계를
그대로 안고 간다. 교체 지점은 이 파일 하나다.
"""

import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, BackgroundTasks, Request
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession, client_ip
from app.core.errors import BadRequest, Conflict, NotFound, Unauthorized
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    normalize_phone,
    read_token,
    verify_password,
)
from app.core.throttle import clear as throttle_clear
from app.core.throttle import guard as throttle_guard
from app.models.enums import ConsentKind, SubscriptionStatus, UserRole
from app.models.ops import Subscription
from app.models.user import Family, FamilyMember, User, UserConsent, UserSettings
from app.schemas.auth import (
    GuardianLogin,
    GuardianRegister,
    MeOut,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    SeniorChoice,
    SeniorLogin,
    SeniorLookup,
    SeniorLookupResult,
    TokenPair,
    UserOut,
    WithdrawRequest,
    WithdrawResult,
)
from app.schemas.common import Ok
from app.services import account, mailer, password_reset

# 없는 계정도 해시를 한 번 돌려 응답 시간을 맞춘다 (가입 여부가 새지 않게)
log = logging.getLogger("hubfamily.auth")

DUMMY_HASH = hash_password("hubfamily-timing-guard")

router = APIRouter(tags=["auth"])

TRIAL_DAYS = 15  # 15일 무료체험 — 사업계획서 BM


def _tokens(user: User, is_new: bool = False) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(user.id, user.token_epoch),
        refresh_token=create_refresh_token(user.id, user.token_epoch),
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
async def login(payload: GuardianLogin, request: Request, session: DBSession) -> TokenPair:
    # 비밀번호를 무제한으로 넣어 볼 수 없게 한다. 계정 쪽은 느슨하게(잠금이 공격 수단이
    # 되지 않도록), 출처 쪽은 촘촘하게 잡는다 (2026-09-11 재점검).
    email = payload.email.lower()
    await throttle_guard(
        "login", email, limit=50, window=600, source=client_ip(request), source_limit=20
    )

    user = await session.scalar(select(User).where(func.lower(User.email) == email))
    # 이메일이 없는 경우와 비밀번호가 틀린 경우를 구분해 알려주지 않는다.
    # 없는 계정이어도 해시를 한 번 돌려 응답 시간으로 가입 여부가 드러나지 않게 한다.
    if user is None or not verify_password(payload.password, user.password_hash):
        if user is None:
            verify_password(payload.password, DUMMY_HASH)
        raise Unauthorized("BAD_CREDENTIALS", "이메일 또는 비밀번호가 맞지 않습니다.")
    await throttle_clear("login", email)
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
async def senior_lookup(
    payload: SeniorLookup, request: Request, session: DBSession
) -> SeniorLookupResult:
    """부모 로그인 1단계. 이름 외의 정보는 내보내지 않는다."""
    # 이름+번호 조합을 자동으로 훑는 것은 출처 기준으로 막는다. 번호를 바꿔 가며
    # 시도하므로 번호 버킷만으로는 스캔이 전혀 안 걸린다 (2026-09-11 재점검).
    await throttle_guard(
        "senior",
        normalize_phone(payload.guardian_phone),
        limit=50,
        window=600,
        source=client_ip(request),
        source_limit=30,
    )
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
async def senior_login(payload: SeniorLogin, request: Request, session: DBSession) -> TokenPair:
    """부모 로그인 2단계. 1단계 정보를 다시 검증하므로 senior_id 만으로는 못 들어온다."""
    await throttle_guard(
        "senior",
        normalize_phone(payload.guardian_phone),
        limit=50,
        window=600,
        source=client_ip(request),
        source_limit=30,
    )
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
        user_id, epoch = read_token(payload.refresh_token, expected_type="refresh")
    except jwt.InvalidTokenError as exc:
        raise Unauthorized("INVALID_TOKEN", "다시 시작해 주세요.") from exc

    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise Unauthorized("USER_NOT_FOUND", "다시 시작해 주세요.")
    # 비밀번호가 바뀌었으면 옛 세션은 여기서 끝난다
    if epoch < user.token_epoch:
        raise Unauthorized("SESSION_ENDED", "비밀번호가 바뀌었습니다. 다시 로그인해 주세요.")
    return _tokens(user)


@router.delete("/me", response_model=WithdrawResult)
async def withdraw(payload: WithdrawRequest, user: CurrentUser, session: DBSession) -> WithdrawResult:
    """탈퇴. 개인정보처리방침에 "탈퇴 즉시 파기" 로 적어 두었으므로 그 자리에서 지운다.

    자녀는 비밀번호를 다시 받는다 — 폰을 잠깐 빌린 사람이 지울 수 있으면 안 된다.
    어르신은 비밀번호가 없어 confirm 만 받는다. 실수 방지는 화면에서 두 번 묻는 것으로 한다.
    """
    if not payload.confirm:
        raise BadRequest("CONFIRM_REQUIRED", "탈퇴를 확인해 주세요.")

    if user.role is UserRole.GUARDIAN:
        if not payload.password:
            raise BadRequest("PASSWORD_REQUIRED", "비밀번호를 입력해 주세요.")
        if not verify_password(payload.password, user.password_hash):
            raise Unauthorized("INVALID_PASSWORD", "비밀번호가 맞지 않습니다.")

    result = await account.withdraw(session, user)
    return WithdrawResult(**result)


async def _send_reset_mail(user_id: uuid.UUID, to: str, subject: str, html: str, text: str) -> None:
    """응답을 보낸 뒤에 실제로 보낸다. 실패는 로그로만 남긴다."""
    try:
        await asyncio.to_thread(mailer.send, to, subject, html, text)
    except Exception as exc:  # noqa: BLE001 — 실패해도 가입 여부를 드러내지 않는다
        log.warning("재설정 메일 발송 실패 user=%s: %s", user_id, exc)


@router.post("/auth/password/forgot", response_model=Ok)
async def forgot_password(
    payload: PasswordResetRequest, request: Request, background: BackgroundTasks, session: DBSession
) -> Ok:
    """재설정 링크를 메일로 보낸다.

    **가입 여부를 응답으로 알려주지 않는다.** 없는 주소여도 똑같이 성공으로 답한다 —
    이 API 로 회원 목록을 훑을 수 없어야 한다.
    메일 발송이 실패해도 성공으로 답하고 로그에만 남긴다 (같은 이유).
    """
    email = payload.email.lower()
    await throttle_guard(
        "forgot", email, limit=20, window=900, source=client_ip(request), source_limit=10
    )

    user = await session.scalar(select(User).where(func.lower(User.email) == email))
    if user is not None and user.is_active and user.password_hash:
        token = password_reset.make_token(user)
        url = password_reset.reset_url(token)
        subject, html, text = password_reset.compose(user.name, url)
        # 응답을 기다리게 하면 **응답 시간으로 가입 여부가 샌다** — 가입된 주소는 SMTP
        # 왕복만큼 느리다 (2026-09-11 재점검). 보내는 일은 응답 뒤로 넘긴다.
        background.add_task(_send_reset_mail, user.id, user.email, subject, html, text)

    return Ok()


@router.post("/auth/password/reset", response_model=Ok)
async def reset_password(payload: PasswordResetConfirm, session: DBSession) -> Ok:
    """링크로 받은 토큰으로 새 비밀번호를 정한다. 링크는 한 번 쓰면 듣지 않는다."""
    try:
        user_id = password_reset.read_token(payload.token)
    except jwt.InvalidTokenError as exc:
        raise BadRequest("INVALID_RESET_TOKEN", "링크가 만료되었거나 올바르지 않습니다.") from exc

    user = await session.get(User, uuid.UUID(user_id))
    # 비밀번호가 없는 계정(어르신)은 이 경로가 성립하지 않는다. 빈 비밀번호의 지문은
    # 모든 계정에서 같아, 막지 않으면 링크의 일회성 보장이 깨진다 (2026-09-11 재점검).
    if user is None or not user.is_active or not user.password_hash:
        raise BadRequest("INVALID_RESET_TOKEN", "링크가 만료되었거나 올바르지 않습니다.")
    # 이미 비밀번호를 바꿨다면 예전 링크는 듣지 않는다 (지문이 달라진다)
    if not password_reset.token_matches(payload.token, user):
        raise BadRequest("INVALID_RESET_TOKEN", "이미 사용한 링크입니다.")

    user.password_hash = hash_password(payload.password)
    # 세대를 올려 이전에 발급된 토큰을 전부 끊는다. 계정을 뺏긴 사람이 비밀번호를 바꿨을 때
    # 공격자가 180일짜리 refresh 로 남아 있으면 안 된다 (2026-09-11 재점검).
    user.token_epoch += 1
    await session.flush()
    await throttle_clear("login", (user.email or "").lower())
    log.info("비밀번호 재설정 완료 user=%s", user.id)
    return Ok()


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
