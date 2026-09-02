"""배포 스모크 테스트.

자녀 가입 → 가족 생성 → 초대 → 어르신 합류 → 체크 → 권한 검증까지 한 번에 태운다.
배포 직후 이 스크립트가 통과하면 API·DB·Redis·프록시가 모두 살아 있다는 뜻이다.

    python scripts/smoke_test.py                       # 기본 127.0.0.1:8000
    python scripts/smoke_test.py http://hubfamily.mangotree.co.kr

주의: ENV=prod 에서는 OTP 코드가 응답에 오지 않으므로 2번 단계에서 멈춘다.
      운영 서버 검증은 SMS 연동(M3) 이후 또는 별도 테스트 계정으로 한다.
"""
import datetime
import json
import random
import sys
import urllib.error
import urllib.request

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


def signup(phone, name, role):
    code = call("POST", "/api/v1/auth/otp/request", {"phone": phone})["dev_code"]
    return call("POST", "/api/v1/auth/otp/verify",
                {"phone": phone, "code": code, "name": name, "role": role})

print("1. 헬스체크")
call("GET", "/health")

print("2. 자녀 가입")
g = signup(new_phone(), "김민수", "guardian")
gt = g["access_token"]
assert g["is_new_user"] is True

print("3. 가족 생성 + 15일 무료체험 시작")
fam = call("POST", "/api/v1/families", {"name": "김영희 가족"}, gt)

print("4. 초대코드 발급")
inv = call("POST", f"/api/v1/families/{fam['id']}/invitations",
           {"target_role": "senior", "relation": "어머니"}, gt)

print("5. 어르신 가입 + 초대코드로 합류")
s = signup(new_phone(), "김영희", "senior")
st = s["access_token"]
call("POST", f"/api/v1/invitations/{inv['code']}/accept", None, st)

print("6. 어르신 단말 등록")
call("POST", "/api/v1/devices", {"platform": "android", "push_token": "tok-test-1"}, st)

print("7. 식사 체크 (화면 2)")
today = datetime.date.today().isoformat()
call("POST", "/api/v1/checks/meals", {"check_date": today, "slot": "breakfast", "status": "ate"}, st)
call("POST", "/api/v1/checks/meals", {"check_date": today, "slot": "lunch", "status": "skipped"}, st)

print("8. 같은 슬롯 재전송 - 오프라인 큐 중복 흡수")
r = call("POST", "/api/v1/checks/meals", {"check_date": today, "slot": "breakfast", "status": "ate"}, st)
rows = call("GET", f"/api/v1/checks/meals?check_date={today}", None, st)
assert len(rows) == 2, f"중복 생성됨: {len(rows)}건"
print("        -> 2건 유지 (중복 없음)")

print("9. 기분 체크 (화면 4)")
call("POST", "/api/v1/checks/moods", {"check_date": today, "slot": "breakfast", "mood": "good"}, st)

print("10. 보호자가 어르신 데이터 조회 - 같은 가족")
senior_id = s["access_token"] and call("GET", "/api/v1/me", None, st)["user"]["id"]
rows = call("GET", f"/api/v1/checks/meals?check_date={today}&user_id={senior_id}", None, gt)
assert len(rows) == 2
print(f"        -> 보호자가 식사 {len(rows)}건 조회 성공")

print("11. 남의 가족 데이터 조회 차단")
o = signup(new_phone(), "남남", "guardian")
call("GET", f"/api/v1/checks/meals?check_date={today}&user_id={senior_id}", None,
     o["access_token"], expect=403)

print("12. 보호자 연락처 (화면 10) + 설정 (화면 9)")
call("POST", "/api/v1/contacts", {"name": "아들 민수", "phone": "010-1234-5678", "relation": "아들"}, st)
call("PATCH", "/api/v1/settings", {"font_scale": 150, "voice_guide": True}, st)
st_out = call("GET", "/api/v1/settings", None, st)
assert st_out["font_scale"] == 150

print("13. 토큰 없이 접근 차단")
call("GET", "/api/v1/me", None, None, expect=401)

print("\n전체 통과")
