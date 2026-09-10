# App Store 제출: 순서와 붙여 넣을 원고

iOS 앱을 App Store 에 올릴 때 입력하는 값을 전부 여기에 모았다.
안드로이드 원고(`docs/store/PLAY_CONSOLE.md`)와 같은 내용이다. 애플 칸 이름과 규격에 맞게 고쳤다.

준비된 파일 (이 폴더)
- `screenshots/6.9/` — iPhone 6.9형 스크린샷 (1320×2868). **이것만 올려도 된다.** 작은 화면용은 애플이 줄여 쓴다
- `screenshots/6.5/` — iPhone 6.5형 (1284×2778). 6.5형 칸을 따로 채우고 싶을 때만
- 앱 아이콘은 빌드에 들어 있다 (`Assets.xcassets/AppIcon`). 따로 올리지 않는다

> 이 앱은 **아이폰 전용**이다 (2026-09-10 결정). 그래서 아이패드 스크린샷은 필요 없다.

---

## 순서

| # | 할 일 | 누가 |
|---|---|---|
| 1 | App Store Connect 에 앱 만들기 | 사용자 |
| 2 | 서버 `APNS_SANDBOX=false` 로 바꾸고 `./deploy.sh` | 사용자 (서버) |
| 3 | Xcode 에서 Archive → App Store Connect 로 업로드 | Xcode |
| 4 | TestFlight 로 내 폰에 설치해 알림까지 확인 | 사용자 |
| 5 | 앱 정보 · 가격 · 개인정보 · 연령 등급 입력 | 사용자 (아래 원고 붙여 넣기) |
| 6 | 1.0 버전 페이지: 스크린샷 · 설명 · 빌드 선택 · 심사 정보 | 사용자 |
| 7 | 심사에 제출 | 사용자 |

---

## 1. 앱 만들기

https://appstoreconnect.apple.com → 앱 → 왼쪽 위 **+** → **신규 앱**

| 항목 | 값 |
|---|---|
| 플랫폼 | iOS |
| 이름 | `허브패밀리` |
| 기본 언어 | 한국어 |
| 번들 ID | `kr.co.mangotree.hubfamily` (목록에 "XC kr co mangotree hubfamily" 로 보인다) |
| SKU | `hubfamily-ios` (내부용. 아무 값이나 되지만 나중에 못 바꾼다) |
| 사용자 액세스 | 전체 액세스 |

> 이름이 이미 쓰이고 있다고 나오면 `허브패밀리 - 부모님 안심 케어` 로 만든다.
> 이름은 나중에 바꿀 수 있지만, 홈 화면 아이콘 아래 이름은 빌드의 `허브패밀리` 그대로다.

## 2. 서버를 운영용 푸시로

TestFlight · App Store 로 받은 앱은 애플의 **운영(Production)** 푸시 서버를 쓴다.

```bash
cd /opt/hubfamily/deploy
sed -i 's/^APNS_SANDBOX=.*/APNS_SANDBOX=false/' .env && grep '^APNS_SANDBOX' .env
./deploy.sh
```

Xcode 로 직접 설치한 개발용 앱도 계속 알림을 받는다. 서버가 `BadDeviceToken` 을 받으면
반대쪽 환경으로 한 번 더 보내기 때문이다 (`backend/app/services/apns.py`).

## 3. Archive · 업로드 (Xcode)

1. 실행 기기를 **Any iOS Device (arm64)** 로 바꾼다 (아이폰이나 시뮬레이터가 선택돼 있으면 Archive 가 회색이다)
2. 메뉴 **Product → Archive** → 몇 분 뒤 Organizer 창이 뜬다
3. **Distribute App** → **App Store Connect** → **Upload** → 다음은 기본값 그대로 → **Upload**
4. 10~30분 뒤 App Store Connect → 앱 → **TestFlight** 에 빌드 `1.0 (1)` 이 보인다

- 버전은 `MARKETING_VERSION = 1.0`, 빌드 번호는 `CURRENT_PROJECT_VERSION = 1` 이다 (App 타깃 General 탭).
  **다시 올릴 때마다 빌드 번호를 +1** 해야 한다. 같은 번호는 거절된다.
- 수출 규정(암호화) 질문은 안 나온다. `Info.plist` 에 `ITSAppUsesNonExemptEncryption = NO` 를 넣어 뒀다
  (HTTPS 말고 다른 암호화를 쓰지 않는다).
- 업로드 전에 `cd webapp && npm run build:app && npx cap sync ios` 로 웹 화면을 최신으로 넣을 것.

## 4. TestFlight 로 확인

TestFlight → 내부 테스트 → 그룹 만들기 → 내 Apple ID 추가 → 폰에 **TestFlight** 앱 설치 → 초대 수락.
설치한 앱에서 부모 계정 로그인 → 약 하나 등록 → 앱 종료 → 알림이 오는지 본다 (운영 푸시 확인).

---

## 5. 앱 정보 (왼쪽 **일반 → 앱 정보**)

| 항목 | 값 |
|---|---|
| 부제 (30자) | `부모님 식사·약·기분 매일 안심 확인` |
| 카테고리 · 기본 | 건강 및 피트니스 |
| 카테고리 · 보조 | 라이프스타일 |
| 콘텐츠 권한 | 제3자 콘텐츠를 포함하지 않음 |
| 연령 등급 | 아래 5-3 |

> "의료" 카테고리는 쓰지 않는다. 의료 카테고리 앱은 의료기기 인허가 자료를 요구받을 수 있고,
> 이 앱은 진단·치료가 아니라 가족 간 기록 확인이다.

### 5-1. 가격 및 사용 가능 여부

- 가격: **무료 (0원)**
- 국가: 대한민국 (전 세계로 열어도 되지만 화면이 한국어뿐이다)

### 5-2. 앱 개인정보 보호 (왼쪽 **앱 개인정보 보호**)

**개인정보 처리방침 URL**
```
https://hubfamily.co.kr/privacy.html
```

**데이터 수집 여부**: 예, 이 앱에서 데이터를 수집합니다

아래 항목만 체크한다. 모든 항목은 같은 답이다:
**용도 = 앱 기능** · **사용자와 연결됨 = 예** · **추적에 사용 = 아니요**

| 애플 분류 | 항목 | 이 앱에서 무엇인가 |
|---|---|---|
| 연락처 정보 | 이름 | 자녀·부모님 이름 |
| 연락처 정보 | 이메일 주소 | 자녀 로그인 |
| 연락처 정보 | 전화번호 | 부모님 로그인, 보호자에게 전화 |
| 건강 및 피트니스 | 건강 | 식사·복약·기분 기록 |
| 사용자 콘텐츠 | 사진 또는 비디오 | 식사 사진 (선택) |
| 식별자 | 기기 ID | 푸시 알림 토큰 |
| 사용 데이터 | 제품 상호 작용 | 마지막 접속 시각 (이상 징후 감지) |
| 진단 | 기타 진단 데이터 | 알림 발송 이력 |
| 기타 데이터 | 기타 데이터 유형 | 출생연도 (선택) |

광고 없음, 제3자 공유 없음, 추적(ATT) 없음. 그래서 "추적" 은 모두 아니요다.

### 5-3. 연령 등급

설문의 모든 항목을 **없음 / 아니요** 로 답한다. 폭력·선정성·도박·약물 오남용·공포 요소가 없다.

- 의료·치료 정보 항목이 나오면: **없음**. 약 이름과 시각은 가족이 직접 적는 기록이다. 앱이 의학 정보를 주지 않는다
- 사용자 간 무제한 소통 · 웹 브라우징 · 사용자 생성 콘텐츠 공개 공유: **아니요** (연결된 가족끼리만 본다)
- 결과는 가장 낮은 등급(4+)이 나와야 한다

---

## 6. iOS 앱 1.0 버전 페이지

### 스크린샷

**iPhone 6.9형 디스플레이** 칸에 `screenshots/6.9/` 의 파일을 번호 순서대로 끌어다 놓는다 (최대 10장).

| 파일 | 화면 |
|---|---|
| `01_start.png` | 시작 · 자녀/부모 선택 |
| `02_senior_home.png` | 부모님 홈 |
| `03_meal.png` | 식사 체크 |
| `04_med.png` | 약 복용 체크 |
| `05_mood.png` | 기분 체크 |
| `06_guardian_home.png` | 자녀 홈 · 오늘 건강 요약 |
| `07_med_manage.png` | 약 복용 관리 |
| `08_report.png` | 리포트 |

### 프로모션 텍스트 (170자, 심사 없이 언제든 바꿀 수 있다)
```
멀리 계신 부모님이 오늘 식사는 하셨는지, 약은 제때 드셨는지 매일 확인하세요. 약 드실 시간이 되면 부모님 폰이 알람처럼 울리고, 자녀는 한 화면에서 모두 봅니다.
```

### 설명 (4000자)
```
허브패밀리는 떨어져 사는 부모님과 자녀를 이어주는 가족 안심 케어 앱입니다.

■ 부모님은 버튼 하나로
· 식사하셨나요? → 먹었어요 / 안 먹었어요
· 약 드셨나요? → 자녀가 등록한 약이 시각과 함께 뜨고, 먹었어요 한 번이면 끝
· 오늘 기분은? → 좋아요 · 괜찮아요 · 힘들어요 중 하나
· 병원 일정 확인, 자녀에게 바로 전화하기
글자와 버튼이 크고, 회원가입도 없습니다. 자녀 이름과 전화번호만 넣으면 들어옵니다.

■ 자녀는 한눈에
· 오늘의 건강 요약: 식사 3/3 · 약 복용 2/2 · 기분 좋음
· 최근 7일 건강 추이
· 약 복용 시간과 병원 일정을 등록하면 부모님 폰에 알림이 갑니다
· 24시간 응답이 없거나 하루 종일 기록이 없으면 이상 징후 알림

■ 약 시간엔 알람처럼
정해진 복용 시각에 부모님 폰이 알람 소리로 울립니다. 자녀가 시간을 바꾸면 바뀐 시각에 울립니다.
(아이폰의 무음 모드에서는 소리 대신 진동과 화면 알림으로 옵니다.)

■ 이런 분께
· 부모님과 떨어져 살면서 "오늘 식사는 하셨나" 매일 걱정되는 분
· 부모님이 약을 제때 드시는지 확인하고 싶은 분
· 스마트폰이 익숙하지 않은 부모님께 복잡한 앱을 드리고 싶지 않은 분

■ 개인정보
건강 기록은 연결된 가족에게만 보이며, 제3자에게 제공하지 않습니다.
개인정보처리방침: https://hubfamily.co.kr/privacy.html

허브패밀리는 가족 간 생활 기록을 나누는 앱이며, 의료 진단이나 치료를 대신하지 않습니다.

문의: privacy@mangotree.co.kr
```

### 키워드 (100자, 쉼표로 구분, 띄어쓰기 없이)
```
부모님,효도,복약,약알림,복약관리,안부,안부확인,어르신,시니어,실버,노인,돌봄,가족,건강관리,식사,케어,독거노인,보호자,병원일정
```
> 앱 이름(허브패밀리)은 애플이 이미 검색에 넣으므로 키워드에 다시 쓰지 않는다.

### URL

| 항목 | 값 |
|---|---|
| 지원 URL (필수) | `https://hubfamily.co.kr` |
| 마케팅 URL (선택) | 비워 둔다 |

### 빌드

**빌드** 칸의 **+** → TestFlight 에 올라온 `1.0 (1)` 선택.

### 저작권
```
2026 주식회사 망고트리
```

### 앱 심사 정보

**로그인 필요**: 체크

| 항목 | 값 |
|---|---|
| 사용자 이름 | `test-parent@example.com` |
| 암호 | `medic1234!` |
| 연락처 이름 · 전화 · 이메일 | 실제 담당자 (심사팀이 연락한다) |

**메모** (심사팀은 영어로 읽는다. 한국어와 함께 둔다)
```
[EN]
HubFamily connects adult children with their elderly parents who live apart. The app has two roles.

1) Child (guardian) — on the first screen tap "자녀예요" (I'm the child) and sign in with the demo account above. You can see today's health summary of the parent, register medications and hospital schedules.

2) Parent (senior) — sign out, then tap "부모예요" (I'm the parent). Enter the child's name "김민수" and phone number "01012345678", then choose "김영희" from the list. Parents do not create an account; the child invites them. Parents check meals, medication and mood with large buttons.

Push notifications: when a medication time registered by the child arrives, the parent's phone receives a time-sensitive notification with an alarm sound. To test, register a medication 3–4 minutes ahead on the child side, sign in as the parent on the device, allow notifications, and close the app.

Camera / photo library access is requested only when the parent adds an optional meal photo.
This app does not provide medical diagnosis or treatment. Records are shared only within the connected family.

[KO]
자녀 계정: 첫 화면 [자녀예요] → 위 계정으로 로그인.
부모님 화면: 로그아웃 → [부모예요] → 자녀 이름 "김민수", 전화번호 "01012345678" → 목록에서 "김영희" 선택.
약 알림 확인: 자녀 화면에서 3~4분 뒤 시각으로 약 등록 → 기기에서 부모로 로그인·알림 허용 → 앱 종료.
```

### 버전 출시

**이 버전을 수동으로 출시** 를 권한다. 심사가 통과돼도 버튼을 눌러야 공개되니 시점을 고를 수 있다.

---

## 7. 심사에서 걸릴 수 있는 것

| 지적 | 답 |
|---|---|
| 5.1.1(v) 계정 삭제 | 앱 안에서 탈퇴된다 (더보기 → 회원 탈퇴, `a915f17`). 업로드 전에 `npx cap sync ios` 로 이 화면이 빌드에 들어갔는지 확인할 것 |
| 4.2 최소 기능 (웹을 감싼 앱) | 푸시 알림(시각 맞춤 알람음), 카메라 · 사진, 전화 걸기가 앱에서만 된다고 답한다 |
| 로그인이 필요해 심사를 못 함 | 심사 정보의 데모 계정과 메모. 운영 서버의 시험용 가족을 **지우지 말 것** |
| 알림이 안 온다 | 서버 `APNS_SANDBOX=false` 인지, 워커 로그의 `event` (sent/failed/skipped) 확인 |
| 5.1.3 건강 데이터 | 개인정보처리방침과 앱 개인정보 표. 광고 · 제3자 공유가 없다고 답한다 |

## 8. 다음 버전을 올릴 때

1. Xcode → App 타깃 → General → **Build** 를 +1 (필요하면 **Version** 도 올린다)
2. `cd webapp && npm run build:app && npx cap sync ios`
3. Product → Archive → Distribute App → Upload
4. App Store Connect → **+ 버전** → "이 버전의 새로운 기능" 작성 → 빌드 선택 → 제출
