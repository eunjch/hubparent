"""계정 탈퇴 — 계획서 11장 · 개인정보처리방침 3·5절.

방침에 "탈퇴 즉시 파기" 라고 공개해 두었으므로 지연 삭제나 비활성 표시를 두지 않는다.
한 번 지우면 되돌릴 수 없다 — 화면에서 두 번 묻는 이유다.

**가족은 자녀가 있어야 성립한다.** 부모님은 자녀 이름·전화번호로 로그인하므로(auth.senior_login)
마지막 자녀가 나가면 부모님은 앱에 들어올 길이 없다. 기록만 남기면 개인정보처리방침의
"탈퇴 즉시 파기" 와도 어긋난다. 그래서 마지막 자녀가 탈퇴하면 가족과 그 안의 부모님 계정까지
함께 지운다. 자녀가 둘 이상이면 나간 사람만 지우고 가족은 그대로 둔다 (2026-09-10 결정).

외래키에 ON DELETE 가 걸려 있지 않다. 지우는 순서가 곧 제약 조건이라 아래 순서를 지켜야 한다.
새 테이블이 users.id 나 families.id 를 가리키게 되면 여기에도 추가할 것 —
`test_withdraw_leaves_no_orphan_rows` 가 빠뜨린 테이블을 잡아 준다.
"""

import shutil
import uuid
from pathlib import Path

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.care import MealCheck, Medication, MedicationLog, MoodCheck, Schedule
from app.models.enums import UserRole
from app.models.monitor import ActivitySignal, Alert, DailyReport
from app.models.notify import LocalNotification, NotificationLog
from app.models.ops import AuditLog, Subscription
from app.models.user import (
    Device,
    EmergencyContact,
    Family,
    FamilyMember,
    User,
    UserConsent,
    UserSettings,
)


async def _family_id_of(session: AsyncSession, user_id: uuid.UUID) -> uuid.UUID | None:
    return await session.scalar(
        select(FamilyMember.family_id).where(FamilyMember.user_id == user_id).limit(1)
    )


async def _guardian_ids(session: AsyncSession, family_id: uuid.UUID) -> list[uuid.UUID]:
    rows = await session.scalars(
        select(FamilyMember.user_id).where(
            FamilyMember.family_id == family_id, FamilyMember.role == UserRole.GUARDIAN
        )
    )
    return list(rows)


async def _member_ids(session: AsyncSession, family_id: uuid.UUID) -> list[uuid.UUID]:
    rows = await session.scalars(
        select(FamilyMember.user_id).where(FamilyMember.family_id == family_id)
    )
    return list(rows)


def _drop_uploads(user_id: uuid.UUID) -> None:
    """식사 사진은 UPLOAD_DIR/<user_id>/ 아래 모인다 (checks.py). 통째로 지운다."""
    folder = Path(settings.UPLOAD_DIR) / str(user_id)
    if folder.is_dir():
        shutil.rmtree(folder, ignore_errors=True)


async def _purge_user(session: AsyncSession, user_id: uuid.UUID) -> None:
    """한 사람과 그 사람에게 달린 기록 전부. 가족 단위 정리는 부르는 쪽에서 먼저 한다."""
    # 복약 기록이 약보다 먼저다 (medication_logs.medication_id → medications.id)
    mine = select(Medication.id).where(Medication.user_id == user_id)
    await session.execute(
        delete(MedicationLog).where(
            (MedicationLog.user_id == user_id) | (MedicationLog.medication_id.in_(mine))
        )
    )
    await session.execute(delete(Medication).where(Medication.user_id == user_id))

    for model in (MealCheck, MoodCheck, ActivitySignal, DailyReport, LocalNotification,
                  NotificationLog, Device, EmergencyContact, UserConsent, UserSettings):
        await session.execute(delete(model).where(model.user_id == user_id))

    await session.execute(delete(AuditLog).where(AuditLog.actor_id == user_id))

    # 남의 알림을 이 사람이 확인해 둔 표시는 지우지 않고 비운다 (알림 자체는 가족 것)
    await session.execute(
        update(Alert).where(Alert.ack_by == user_id).values(ack_by=None)
    )
    await session.execute(delete(Alert).where(Alert.target_user_id == user_id))
    await session.execute(
        delete(Schedule).where(
            (Schedule.target_user_id == user_id) | (Schedule.created_by == user_id)
        )
    )

    await session.execute(delete(FamilyMember).where(FamilyMember.user_id == user_id))
    await session.execute(delete(User).where(User.id == user_id))
    _drop_uploads(user_id)


async def _purge_family(session: AsyncSession, family_id: uuid.UUID) -> int:
    """가족 전체. 구성원 수를 돌려준다."""
    members = await _member_ids(session, family_id)

    # 가족에 매인 것부터 — 개인별 정리보다 먼저 치워야 users 행을 지울 수 있다
    await session.execute(delete(Subscription).where(Subscription.family_id == family_id))
    await session.execute(delete(Alert).where(Alert.family_id == family_id))
    await session.execute(delete(Schedule).where(Schedule.family_id == family_id))
    await session.execute(delete(FamilyMember).where(FamilyMember.family_id == family_id))
    # families.created_by 가 아직 살아 있는 users 행을 가리키는 동안 지운다
    await session.execute(delete(Family).where(Family.id == family_id))

    for member_id in members:
        await _purge_user(session, member_id)
    return len(members)


async def withdraw(session: AsyncSession, user: User) -> dict:
    """탈퇴시킨다. 무엇을 지웠는지 요약해 돌려준다 (화면에서 문구를 고르는 데 쓴다)."""
    user_id = user.id
    family_id = await _family_id_of(session, user_id)

    if family_id is None:
        # 가족에 속하지 않은 계정 — 자기 것만 지운다
        await _purge_user(session, user_id)
        await session.flush()
        return {"scope": "user", "deleted_users": 1}

    if user.role is not UserRole.GUARDIAN:
        # 부모님 — 가족은 남는다
        await _purge_user(session, user_id)
        await session.flush()
        return {"scope": "user", "deleted_users": 1}

    others = [g for g in await _guardian_ids(session, family_id) if g != user_id]
    if not others:
        # 마지막 자녀 — 부모님은 더 이상 로그인할 수 없으므로 가족째 지운다
        count = await _purge_family(session, family_id)
        await session.flush()
        return {"scope": "family", "deleted_users": count}

    # 자녀가 더 있다 — 이 사람이 만든 것들을 남은 자녀에게 넘기고 본인만 지운다
    heir = others[0]
    await session.execute(
        update(Family).where(Family.created_by == user_id).values(created_by=heir)
    )
    await session.execute(
        update(Schedule)
        .where(Schedule.family_id == family_id, Schedule.created_by == user_id)
        .values(created_by=heir)
    )
    await _purge_user(session, user_id)
    await session.flush()
    return {"scope": "user", "deleted_users": 1}
