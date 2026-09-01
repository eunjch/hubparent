"""보호자 연락처(화면 10) · 설정(화면 9)."""

import uuid

from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import CurrentUser, DBSession
from app.core.errors import NotFound
from app.models.user import EmergencyContact, UserSettings
from app.schemas.common import Ok
from app.schemas.user import ContactIn, ContactOut, SettingsIn, SettingsOut

router = APIRouter(tags=["profile"])


@router.get("/contacts", response_model=list[ContactOut])
async def list_contacts(user: CurrentUser, session: DBSession) -> list[ContactOut]:
    rows = await session.scalars(
        select(EmergencyContact)
        .where(EmergencyContact.user_id == user.id)
        .order_by(EmergencyContact.sort_order)
    )
    return [ContactOut.model_validate(r) for r in rows]


@router.post("/contacts", response_model=ContactOut)
async def add_contact(payload: ContactIn, user: CurrentUser, session: DBSession) -> ContactOut:
    row = EmergencyContact(user_id=user.id, **payload.model_dump())
    session.add(row)
    await session.flush()
    return ContactOut.model_validate(row)


@router.delete("/contacts/{contact_id}", response_model=Ok)
async def delete_contact(contact_id: uuid.UUID, user: CurrentUser, session: DBSession) -> Ok:
    row = await session.get(EmergencyContact, contact_id)
    if row is None or row.user_id != user.id:
        raise NotFound("CONTACT_NOT_FOUND", "연락처를 찾을 수 없습니다.")
    await session.delete(row)
    return Ok()


async def _get_or_create_settings(session: DBSession, user_id: uuid.UUID) -> UserSettings:
    row = await session.scalar(select(UserSettings).where(UserSettings.user_id == user_id))
    if row is None:
        row = UserSettings(user_id=user_id)
        session.add(row)
        await session.flush()
    return row


@router.get("/settings", response_model=SettingsOut)
async def get_settings(user: CurrentUser, session: DBSession) -> SettingsOut:
    return SettingsOut.model_validate(await _get_or_create_settings(session, user.id))


@router.patch("/settings", response_model=SettingsOut)
async def update_settings(payload: SettingsIn, user: CurrentUser, session: DBSession) -> SettingsOut:
    row = await _get_or_create_settings(session, user.id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    await session.flush()
    return SettingsOut.model_validate(row)
