"""복약 — 자녀가 등록하고(G4) 어르신이 응답한다(S3).

계획서 7.3: 약 복용 시간은 **자녀가 설정한다.** 어르신 화면은 "복용함 / 안 먹었어요" 뿐이다.
그래서 등록·수정·삭제는 보호자 권한이고, 응답은 본인만 할 수 있다.
"""

import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession, assert_family_access, require_guardian
from app.core.errors import Conflict, Forbidden, NotFound
from app.core.timeutil import as_utc
from app.models.care import Medication, MedicationLog
from app.models.enums import UserRole
from app.schemas.common import Ok
from app.schemas.medication import (
    DoseAnswer,
    DoseOut,
    MedicationCreate,
    MedicationOut,
    MedicationUpdate,
)
from app.services import medication as med_service
from app.services import presence

router = APIRouter(tags=["medications"])


async def _owned(session: DBSession, user: CurrentUser, medication_id: uuid.UUID) -> Medication:
    med = await session.get(Medication, medication_id)
    if med is None:
        raise NotFound("MEDICATION_NOT_FOUND", "약을 찾을 수 없습니다.")
    await assert_family_access(session, user, med.user_id)
    return med


@router.get("/medications", response_model=list[MedicationOut])
async def list_medications(
    user: CurrentUser,
    session: DBSession,
    user_id: uuid.UUID | None = Query(default=None, description="비우면 본인 것"),
) -> list[MedicationOut]:
    target = user_id or user.id
    await assert_family_access(session, user, target)

    rows = await session.scalars(
        select(Medication)
        .where(Medication.user_id == target, Medication.is_active.is_(True))
        .order_by(Medication.created_at)
    )
    return [MedicationOut.model_validate(r) for r in rows]


@router.post("/medications", response_model=MedicationOut, dependencies=[Depends(require_guardian)])
async def create_medication(
    payload: MedicationCreate, user: CurrentUser, session: DBSession
) -> MedicationOut:
    await assert_family_access(session, user, payload.user_id)

    med = Medication(
        user_id=payload.user_id,
        name=payload.name.strip(),
        dose=payload.dose,
        times=payload.times,
        weekdays=payload.weekdays,
        start_date=payload.start_date or med_service.today_kst(),
        end_date=payload.end_date,
    )
    session.add(med)
    await session.flush()
    return MedicationOut.model_validate(med)


@router.patch(
    "/medications/{medication_id}",
    response_model=MedicationOut,
    dependencies=[Depends(require_guardian)],
)
async def update_medication(
    medication_id: uuid.UUID, payload: MedicationUpdate, user: CurrentUser, session: DBSession
) -> MedicationOut:
    med = await _owned(session, user, medication_id)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(med, field, value)
    await session.flush()

    # 시각이 바뀌면 단말의 로컬 알림 예약도 바뀌어야 한다 — 계획서 8.5.1
    # TODO(M3): 무음 푸시로 재동기화 신호를 보낸다
    return MedicationOut.model_validate(med)


@router.delete(
    "/medications/{medication_id}", response_model=Ok, dependencies=[Depends(require_guardian)]
)
async def delete_medication(
    medication_id: uuid.UUID, user: CurrentUser, session: DBSession
) -> Ok:
    """복용 이력이 남아야 하므로 지우지 않고 내린다."""
    med = await _owned(session, user, medication_id)
    med.is_active = False
    med.end_date = med_service.today_kst()
    await session.flush()
    return Ok()


@router.get("/medications/today", response_model=list[DoseOut])
async def today_doses(
    user: CurrentUser,
    session: DBSession,
    user_id: uuid.UUID | None = Query(default=None, description="비우면 본인 것"),
    day: date | None = Query(default=None, description="비우면 오늘(KST)"),
) -> list[DoseOut]:
    """화면 S3. 오늘 먹어야 할 약과 응답 상태."""
    target = user_id or user.id
    await assert_family_access(session, user, target)

    rows = await med_service.with_status(session, target, day or med_service.today_kst())
    return [
        DoseOut(
            medication_id=o.medication.id,
            name=o.medication.name,
            dose=o.medication.dose,
            time=o.time_label,
            scheduled_at=o.scheduled_at,
            status=status,
        )
        for o, status in rows
    ]


@router.post("/medications/{medication_id}/logs", response_model=DoseOut)
async def answer_dose(
    medication_id: uuid.UUID, payload: DoseAnswer, user: CurrentUser, session: DBSession
) -> DoseOut:
    """어르신이 "복용함 / 안 먹었어요" 를 누른다.

    본인만 응답할 수 있다. 자녀가 대신 눌러 주면 기록의 의미가 사라진다.
    같은 건을 다시 누르면 마지막 답으로 덮는다 — 되돌리기를 위해서다 (계획서 9장).
    """
    med = await session.get(Medication, medication_id)
    if med is None:
        raise NotFound("MEDICATION_NOT_FOUND", "약을 찾을 수 없습니다.")
    if med.user_id != user.id or user.role is not UserRole.SENIOR:
        raise Forbidden("SENIOR_ONLY", "본인만 응답할 수 있습니다.")

    scheduled_at = as_utc(payload.scheduled_at)

    row = await session.scalar(
        select(MedicationLog).where(
            MedicationLog.medication_id == medication_id,
            MedicationLog.scheduled_at == scheduled_at,
        )
    )
    now = datetime.now(UTC)
    if row is None:
        row = MedicationLog(
            medication_id=medication_id,
            user_id=user.id,
            scheduled_at=scheduled_at,
            status=payload.status,
            responded_at=now,
        )
        session.add(row)
    else:
        if row.user_id != user.id:
            raise Conflict("NOT_YOURS", "본인 기록이 아닙니다.")
        row.status = payload.status
        row.responded_at = now

    await presence.touch(session, user.id)
    await session.flush()

    return DoseOut(
        medication_id=medication_id,
        name=med.name,
        dose=med.dose,
        time=payload.scheduled_at.astimezone(med_service.KST).strftime("%H:%M"),
        scheduled_at=scheduled_at,
        status=row.status,
    )
