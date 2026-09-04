"""배포 스모크 테스트.

자녀 회원가입 → 로그인 → 부모님 N명 등록 → 어르신 로그인 → 체크 → 권한까지
한 번에 태운다. 배포 직후 이 스크립트가 통과하면 API·DB·Redis·프록시가 살아 있다는 뜻이다.

    python scripts/smoke_test.py                              # 기본 127.0.0.1:8000
    python scripts/smoke_test.py http://hubfamily.mangotree.co.kr
"""

import datetime
import json
import random
import sys
import urllib.error
import urllib.request

# Windows 콘솔(cp949)에서도 한글·기호가 깨지지 않게 한다
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8000"


def call(method, path, body=None, token=None, expect=200):
    url = BASE + path
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json; charset=utf-8")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            status, payload = r.status, json.loads(r.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as e:
        status, payload = e.code, json.loads(e.read().decode("utf-8") or "null")
    ok = "OK " if status == expect else "FAIL"
    print(f"  [{ok}] {method} {path} -> {status}")
    if status != expect:
        print(f"        기대 {expect}, 응답: {payload}")
        sys.exit(1)
    return payload


def new_phone() -> str:
    """실행마다 새 계정을 만든다. 스모크 테스트는 몇 번을 돌려도 같아야 한다."""
    return f"010{random.randint(0, 99_999_999):08d}"


print("1. 헬스체크")
call("GET", "/health")

print("2. 자녀 회원가입 (이메일 + 비밀번호)")
email = f"smoke{random.randint(0, 10**9)}@example.com"
g = call(
    "POST",
    "/api/v1/auth/register",
    {
        "email": email,
        "password": "hubfamily1234",
        "name": "김민수",
        "phone": new_phone(),
        "agree_health_data": True,
        "agree_email_report": True,
    },
)
gt = g["access_token"]
assert g["is_new_user"] is True
guardian_name = "김민수"
guardian_phone = call("GET", "/api/v1/me", None, gt)["user"]["phone"]

print("3. 필수 동의 없으면 거부")
call(
    "POST",
    "/api/v1/auth/register",
    {
        "email": f"x{random.randint(0, 10**9)}@example.com",
        "password": "hubfamily1234",
        "name": "동의안함",
        "phone": new_phone(),
    },
    expect=409,
)

print("4. 이메일 + 비밀번호로 로그인")
call("POST", "/api/v1/auth/login", {"email": email, "password": "hubfamily1234"})
call("POST", "/api/v1/auth/login", {"email": email, "password": "wrongpassword"}, expect=401)

print("5. 부모님 두 분 등록 (자녀 1 : 부모 N)")
mom = call(
    "POST",
    "/api/v1/family/seniors",
    {"name": "김영희", "phone": new_phone(), "relation": "어머니"},
    gt,
)
call(
    "POST",
    "/api/v1/family/seniors",
    {"name": "김철수", "phone": new_phone(), "relation": "아버지"},
    gt,
)
seniors = call("GET", "/api/v1/family/seniors", None, gt)
assert len(seniors) == 2
print(f"        -> 부모님 {len(seniors)}명 등록")

print("6. 부모 로그인 1단계 — 자녀 이름 + 자녀 번호")
found = call(
    "POST",
    "/api/v1/auth/senior/lookup",
    {"guardian_name": guardian_name, "guardian_phone": guardian_phone},
)
assert {s["name"] for s in found["seniors"]} == {"김영희", "김철수"}

print("7. 부모 로그인 2단계 — 본인 선택")
claim = call(
    "POST",
    "/api/v1/auth/senior/login",
    {
        "guardian_name": guardian_name,
        "guardian_phone": guardian_phone,
        "senior_id": mom["id"],
    },
)
st = claim["access_token"]
me = call("GET", "/api/v1/me", None, st)
assert me["user"]["role"] == "senior"
assert me["user"]["name"] == "김영희"
assert me["consented"] is True
senior_id = mom["id"]

print("8. 자녀 정보가 틀리면 거부")
call(
    "POST",
    "/api/v1/auth/senior/lookup",
    {"guardian_name": "다른사람", "guardian_phone": guardian_phone},
    expect=404,
)

print("9. 어르신 단말 등록")
call("POST", "/api/v1/devices", {"platform": "android", "push_token": "tok-smoke"}, st)

print("10. 식사 체크 (화면 2)")
today = datetime.date.today().isoformat()
call("POST", "/api/v1/checks/meals", {"check_date": today, "slot": "breakfast", "status": "ate"}, st)
call(
    "POST", "/api/v1/checks/meals", {"check_date": today, "slot": "lunch", "status": "skipped"}, st
)

print("11. 같은 슬롯 재전송 — 오프라인 큐 중복 흡수")
call("POST", "/api/v1/checks/meals", {"check_date": today, "slot": "breakfast", "status": "ate"}, st)
rows = call("GET", f"/api/v1/checks/meals?check_date={today}", None, st)
assert len(rows) == 2, f"중복 생성됨: {len(rows)}건"
print("        -> 2건 유지 (중복 없음)")

print("12. 기분 체크 (화면 4)")
call("POST", "/api/v1/checks/moods", {"check_date": today, "slot": "breakfast", "mood": "good"}, st)

print("13. 보호자가 어르신 데이터 조회 — 같은 가족")
rows = call("GET", f"/api/v1/checks/meals?check_date={today}&user_id={senior_id}", None, gt)
assert len(rows) == 2
print(f"        -> 보호자가 식사 {len(rows)}건 조회 성공")

print("14. 남의 가족 데이터 조회 차단")
o = call(
    "POST",
    "/api/v1/auth/register",
    {
        "email": f"other{random.randint(0, 10**9)}@example.com",
        "password": "hubfamily1234",
        "name": "남남",
        "phone": new_phone(),
        "agree_health_data": True,
    },
)
call(
    "GET",
    f"/api/v1/checks/meals?check_date={today}&user_id={senior_id}",
    None,
    o["access_token"],
    expect=403,
)

print("15. 보호자 연락처 (화면 10) + 설정 (화면 9)")
call("POST", "/api/v1/contacts", {"name": "아들 민수", "phone": "010-1234-5678", "relation": "아들"}, st)
call("PATCH", "/api/v1/settings", {"font_scale": 150, "voice_guide": True}, st)
assert call("GET", "/api/v1/settings", None, st)["font_scale"] == 150

print("16. 토큰 없이 접근 차단")
call("GET", "/api/v1/me", None, None, expect=401)

print(f"\n전체 통과 — {BASE}")
