"""계정 · 가족 · 단말."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPKMixin, enum_column
from app.models.enums import ConsentKind, DevicePlatform, UserRole


class User(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "users"

    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    # 자녀의 로그인 ID 겸 리포트 메일 주소. 어르신은 비어 있다.
    # NULL 이 여럿 허용되므로 어르신 계정에는 제약이 걸리지 않는다.
    email: Mapped[str | None] = mapped_column(String(120), unique=True, index=True)
    # 자녀만 갖는다. 어르신은 자녀 이름·번호로 들어오므로 비밀번호가 없다.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[UserRole] = enum_column(UserRole, nullable=False)
    birth_year: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # 발급된 토큰의 세대. 비밀번호를 바꾸면 올린다 → 그 이전 토큰은 모두 무효가 된다.
    # 폐기 목록 없이 세션을 끊는 가장 단순한 방법이다 (2026-09-11 재점검).
    token_epoch: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # 민감정보 수집·이용 동의 시각. 없으면 서비스 이용 불가 — 계획서 11장
    consented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    memberships: Mapped[list["FamilyMember"]] = relationship(back_populates="user")
    consents: Mapped[list["UserConsent"]] = relationship(back_populates="user")
    devices: Mapped[list["Device"]] = relationship(back_populates="user")
    settings: Mapped["UserSettings | None"] = relationship(back_populates="user", uselist=False)


class Family(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "families"

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    members: Mapped[list["FamilyMember"]] = relationship(back_populates="family")


class FamilyMember(Base, UUIDPKMixin, TimestampMixin):
    """가족–사용자 N:M. 보호자 권한 검증의 기준이 된다."""

    __tablename__ = "family_members"
    __table_args__ = (UniqueConstraint("family_id", "user_id", name="uq_family_member"),)

    family_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("families.id"), index=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    role: Mapped[UserRole] = enum_column(UserRole, nullable=False)
    relation: Mapped[str | None] = mapped_column(String(20))  # 아들 · 딸 · 어머니 …

    family: Mapped[Family] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")




class Device(Base, UUIDPKMixin, TimestampMixin):
    """푸시 토큰 + 생존 신호 기준점.

    last_seen_at 은 앱 실행 / 체크 입력 / heartbeat 중 하나라도 오면 갱신된다.
    이 값이 NO_RESPONSE_HOURS 를 넘으면 이상 징후 알림이 생성된다 — 계획서 8.2.
    """

    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("push_token", name="uq_device_push_token"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    platform: Mapped[DevicePlatform] = enum_column(DevicePlatform, nullable=False)
    push_token: Mapped[str | None] = mapped_column(String(255))
    app_version: Mapped[str | None] = mapped_column(String(20))
    # 알림 권한을 허락했는가. 거부하면 복약 알림이 아예 안 울리는데 아무도 모르던 것을
    # 화면에 띄우기 위해 단말이 올려 준다 (계획서 8.5.8 · 2026-09-11 점검).
    # None = 아직 보고한 적 없음(옛 버전 앱)
    notifications_granted: Mapped[bool | None] = mapped_column(Boolean)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)

    user: Mapped[User] = relationship(back_populates="devices")


class EmergencyContact(Base, UUIDPKMixin, TimestampMixin):
    """화면 10 — 어르신이 바로 전화 거는 보호자 연락처."""

    __tablename__ = "emergency_contacts"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    relation: Mapped[str | None] = mapped_column(String(20))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class UserSettings(Base, UUIDPKMixin, TimestampMixin):
    """화면 9 — 글자 크기 배율과 음성 안내는 고령자 UX 규칙과 직결된다 (계획서 9장)."""

    __tablename__ = "user_settings"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_settings"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    font_scale: Mapped[int] = mapped_column(Integer, default=100, nullable=False)  # 100 · 125 · 150
    voice_guide: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_meal: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_medication: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_schedule: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped[User] = relationship(back_populates="settings")


class UserConsent(Base, UUIDPKMixin):
    """동의 이력.

    개인정보보호법 대응. 언제 동의했고 언제 철회했는지가 남아야 한다.
    users 에 불리언으로 두면 철회 시점이 사라지므로 별도 테이블로 둔다 — 계획서 12.1.
    """

    __tablename__ = "user_consents"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    kind: Mapped[ConsentKind] = enum_column(ConsentKind, nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="consents")
