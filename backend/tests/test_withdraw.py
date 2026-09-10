"""탈퇴 — 계획서 11장 · 개인정보처리방침 3·5절.

방침에 "탈퇴 즉시 파기" 로 공개했으므로 흔적이 남으면 안 된다.
`test_withdraw_leaves_no_orphan_rows` 가 모든 외래키를 훑어 빠뜨린 테이블을 잡는다 —
새 테이블이 users.id 나 families.id 를 가리키게 되어도 이 테스트가 알려 준다.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models.base import Base
from app.models.user import Family, User
from tests.test_medications import _add_med, _family
from tests.test_onboarding import GUARDIAN, _register

PASSWORD = GUARDIAN["password"]


async def _withdraw(client, token, **body):
    return await client.request(
        "DELETE",
        "/api/v1/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"confirm": True, **body},
    )


async def _fill_records(client, gt, st, senior_id):
    """지워져야 할 것들을 골고루 만들어 둔다."""
    today = datetime.now(UTC).date().isoformat()
    await _add_med(client, gt, senior_id, times=["08:00"])
    await client.post(
        "/api/v1/schedules",
        headers={"Authorization": f"Bearer {gt}"},
        json={
            "target_user_id": senior_id,
            "title": "내과",
            "start_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        },
    )
    await client.post(
        "/api/v1/checks/meals",
        headers={"Authorization": f"Bearer {st}"},
        json={"check_date": today, "slot": "breakfast", "status": "ate"},
    )
    await client.post(
        "/api/v1/checks/moods",
        headers={"Authorization": f"Bearer {st}"},
        json={"check_date": today, "slot": "breakfast", "mood": "good"},
    )
    await client.post(
        "/api/v1/devices",
        headers={"Authorization": f"Bearer {st}"},
        json={"platform": "android", "push_token": "tok-senior", "app_version": "0.1.0"},
    )


async def _count(session, model) -> int:
    return await session.scalar(select(func.count()).select_from(model))


@pytest.mark.asyncio
async def test_last_guardian_withdrawal_deletes_the_whole_family(client, session):
    """마지막 자녀가 나가면 부모님은 로그인할 길이 없다. 가족째 지운다."""
    gt, st, senior_id = await _family(client)
    await _fill_records(client, gt, st, senior_id)

    assert await _count(session, User) == 2

    res = await _withdraw(client, gt, password=PASSWORD)
    assert res.status_code == 200, res.text
    assert res.json() == {"scope": "family", "deleted_users": 2}

    session.expire_all()
    assert await _count(session, User) == 0
    assert await _count(session, Family) == 0

    # 부모님 토큰도 더는 통하지 않는다
    after = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {st}"})
    assert after.status_code == 401


@pytest.mark.asyncio
async def test_withdrawal_with_another_guardian_keeps_the_family(client, session):
    """자녀가 둘이면 나간 사람만 지운다. 부모님 기록은 그대로 남아야 한다."""
    gt, st, senior_id = await _family(client)
    await _fill_records(client, gt, st, senior_id)

    # 같은 가족에 자녀 한 명 더. 자녀 초대 API 가 아직 없어서 가족 구성원 행을 직접 옮긴다.
    from app.models.enums import UserRole
    from app.models.ops import Subscription
    from app.models.user import FamilyMember

    first_family_id = await session.scalar(select(Family.id))
    second = await _register(client, email="second@example.com", phone="010-9999-8888", name="김둘째")
    second_id = await session.scalar(select(User.id).where(User.email == "second@example.com"))

    # 가입하면 자기 가족이 함께 생긴다. 그 가족을 치우고 첫째 가족에 넣는다
    own_family_id = await session.scalar(
        select(FamilyMember.family_id).where(FamilyMember.user_id == second_id)
    )
    await session.execute(
        FamilyMember.__table__.delete().where(FamilyMember.user_id == second_id)
    )
    await session.execute(
        Subscription.__table__.delete().where(Subscription.family_id == own_family_id)
    )
    await session.execute(Family.__table__.delete().where(Family.id == own_family_id))
    session.add(FamilyMember(family_id=first_family_id, user_id=second_id, role=UserRole.GUARDIAN))
    await session.flush()

    res = await _withdraw(client, gt, password=PASSWORD)
    assert res.status_code == 200, res.text
    assert res.json() == {"scope": "user", "deleted_users": 1}

    session.expire_all()
    # 부모님과 남은 자녀는 살아 있다
    left = list(await session.scalars(select(User.name)))
    assert sorted(left) == ["김둘째", "김영희"]
    assert await _count(session, Family) == 1

    # 남은 자녀가 가족을 물려받았다 — created_by 가 사라진 사람을 가리키면 안 된다
    family = await session.scalar(select(Family))
    assert family.created_by == second_id

    # 부모님은 그대로 쓸 수 있다
    still = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {st}"})
    assert still.status_code == 200

    assert second["access_token"]


@pytest.mark.asyncio
async def test_senior_withdrawal_keeps_the_family(client, session):
    """부모님이 나가도 자녀 계정과 가족은 남는다."""
    gt, st, senior_id = await _family(client)
    await _fill_records(client, gt, st, senior_id)

    res = await _withdraw(client, st)  # 어르신은 비밀번호가 없다
    assert res.status_code == 200, res.text
    assert res.json() == {"scope": "user", "deleted_users": 1}

    session.expire_all()
    assert await _count(session, Family) == 1
    left = list(await session.scalars(select(User.name)))
    assert left == ["김민수"]

    # 자녀 화면에서 부모님이 사라진다
    seniors = await client.get("/api/v1/family/seniors", headers={"Authorization": f"Bearer {gt}"})
    assert seniors.status_code == 200
    assert seniors.json() == []


@pytest.mark.asyncio
async def test_withdrawal_needs_confirm_and_the_right_password(client, session):
    """사고로 부르거나 폰을 잠깐 빌린 사람이 지울 수 없어야 한다."""
    gt, _st, _senior_id = await _family(client)

    res = await client.request(
        "DELETE",
        "/api/v1/me",
        headers={"Authorization": f"Bearer {gt}"},
        json={"confirm": False, "password": PASSWORD},
    )
    assert res.status_code == 400
    assert res.json()["code"] == "CONFIRM_REQUIRED"

    res = await _withdraw(client, gt)
    assert res.status_code == 400
    assert res.json()["code"] == "PASSWORD_REQUIRED"

    res = await _withdraw(client, gt, password="틀린비밀번호")
    assert res.status_code == 401
    assert res.json()["code"] == "INVALID_PASSWORD"

    session.expire_all()
    assert await _count(session, User) == 2  # 아무도 안 지워졌다


@pytest.mark.asyncio
async def test_withdraw_leaves_no_orphan_rows(client, session):
    """모든 외래키를 훑어 사라진 계정·가족을 가리키는 행이 없는지 본다.

    users.id 나 families.id 를 가리키는 테이블이 새로 생기면 services/account.py 에도
    추가해야 한다. 안 하면 여기서 걸린다.
    """
    gt, st, senior_id = await _family(client)
    await _fill_records(client, gt, st, senior_id)

    res = await _withdraw(client, gt, password=PASSWORD)
    assert res.status_code == 200, res.text

    session.expire_all()
    tables = {t.name: t for t in Base.metadata.sorted_tables}
    checked = 0
    leftovers: list[str] = []

    for table in tables.values():
        for fk in table.foreign_keys:
            target = fk.column.table.name
            if target not in {"users", "families"}:
                continue
            checked += 1
            rows = await session.scalar(
                select(func.count()).select_from(table).where(fk.parent.is_not(None))
            )
            if rows:
                leftovers.append(f"{table.name}.{fk.parent.name} 에 {rows}행 남음")

    assert checked >= 15, f"외래키를 {checked}개만 봤다 — 모델을 못 읽은 것 아닌가"
    assert leftovers == [], "지워지지 않은 행: " + ", ".join(leftovers)
