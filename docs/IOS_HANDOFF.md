# iOS 작업 인계 — Mac 에서 이어서 할 일

이 문서는 **Mac mini 에서 이 작업을 이어받는 클로드**에게 주는 지시서다.
Windows PC 에서 할 수 있는 부분은 전부 끝내 커밋했다 (2026-09-10). 남은 건 Mac 이 있어야 하는 것뿐이다.

저장소: `https://github.com/eunjch/hubparent.git` · 브랜치 `main`

---

## 0. 이 프로젝트가 뭔가

**허브패밀리** — 떨어져 사는 부모님(60~80대)과 자녀(30~50대)를 잇는 가족 케어 앱.
부모님은 식사·약·기분을 큰 버튼으로 체크하고, 자녀는 그것을 한눈에 보고 약·일정을 등록한다.

| 부분 | 스택 | 위치 |
|---|---|---|
| 웹앱 | React 18 + TS + Vite | `webapp/` |
| 앱 껍데기 | Capacitor 8 | `mobile/android`, `mobile/ios` |
| 서버 | FastAPI + PostgreSQL + Redis | `backend/` |
| 배포 | Docker Compose 뒤에 사용자의 Apache | `deploy/` · https://hubfamily.co.kr |

화면 코드는 안드로이드와 iOS 가 **완전히 같다**. 앱에서만 도는 것은 `webapp/src/native/bridge.ts` 의
알림·카메라 브릿지뿐이다.

---

## 1. 절대 하지 말 것

- **`mobile/android/` 를 건드리지 말 것.** 안드로이드 앱은 지금 **Google Play 심사 중**이다.
  이 폴더나 `docs/store/app-release.aab` 가 바뀌면 심사본과 저장소가 어긋난다.
- **비밀 파일을 커밋하지 말 것.** `.gitignore` 에 이미 들어 있다:
  `*.p8`, `GoogleService-Info.plist`, `google-services.json`, `*.jks`, `keystore.properties`,
  `firebase-adminsdk*.json`. 실수로 `git add -A` 하기 전에 `git status` 를 볼 것.
- **서버에 직접 접속하지 말 것.** SSH 키가 없다. 서버 명령(`./deploy.sh`, 파일 업로드, `.env` 수정)은
  **사용자가 직접 실행한다.** 필요한 명령을 알려주고 결과를 받아서 판단할 것.
  서버는 사이트 100여 개가 함께 도는 공용 호스트라 Apache 는 사람이 확인하고 만진다.
- **디자인을 다시 하지 말 것.** 41개 화면 리디자인이 이미 반영돼 있다 (`webapp/src/shared/redesign.css`).

---

## 2. 이미 되어 있는 것 (다시 하지 말 것)

- `mobile/ios/` 프로젝트 생성 완료. Capacitor 8 은 **Swift Package Manager** 를 쓰므로
  `pod install` 이 필요 없다. `App.xcodeproj` 를 바로 열면 된다.
- `Info.plist` 에 카메라·사진 권한 문구와 `UIBackgroundModes: remote-notification` 이 들어 있다.
  (권한 문구가 없으면 식사 사진 기능을 쓰는 순간 앱이 죽는다.)
- 알람음 `mobile/ios/App/App/medic_alarm.wav` (29초)를 **Xcode 리소스로 등록해 뒀다**
  (`project.pbxproj` 의 Resources 빌드 단계). 애플 제한이 "30초 **미만**" 이라 안드로이드용 30초를 잘라 넣은 것이다.
  딱 30.0초면 애플이 무시하고 기본음을 낸다.
- 앱 아이콘·스플래시를 프로젝트 로고로 생성해 뒀다.
- **서버의 APNs 발송 코드가 완성돼 있다** — `backend/app/services/apns.py`. 테스트 61개 통과.

### 푸시 구조 (여기가 핵심이다)

Capacitor 푸시 플러그인은 iOS 에서 **APNs 토큰**을 준다 (플러그인 문서: "On iOS it contains the APNS
token"). FCM 은 이 토큰을 못 받는다. 안드로이드 앱을 갈아엎지 않으려고, **서버가 플랫폼을 보고 갈라 보낸다.**

| | 안드로이드 | iOS |
|---|---|---|
| 경로 | 서버 → FCM → 폰 | 서버 → APNs → 폰 |
| 알람음 | 채널 `medication_alarm` 이 정함 | 알림마다 `medic_alarm.wav` 지정 |
| 세게 울리기 | 채널 importance 5 + USAGE_ALARM | `interruption-level: time-sensitive` |
| 서버 키 | `deploy/firebase-adminsdk.json` | `deploy/apns-key.p8` ← **아직 없음** |

- iOS 는 Firebase 를 **전혀 타지 않는다.** `GoogleService-Info.plist` 도 `google-services.json` 도
  Mac 에 없어도 된다. `VITE_PUSH_ENABLED` 는 안드로이드에서만 보는 값이다 (`bridge.ts` 참고).
- 무음 스위치까지 뚫는 Critical Alerts 는 애플 승인이 필요해 **쓰지 않는다.** time-sensitive 까지가 지금 범위다.
- 알림은 **서버 푸시 하나뿐이다.** 로컬 알람은 같은 약이 두 번 울려서 2026-09-09 에 뺐다. 되살리지 말 것.
- 워커가 1분마다 돌며 복용 시각이 된 약을 푸시한다. 재알림(30분·2시간)은 `MED_ESCALATION=false` 로 보류 중이다.

---

## 3. 할 일 — 순서대로

푸시를 나중에 붙이는 순서다. 한꺼번에 하면 안 될 때 원인을 못 가린다.

### 1단계 — 아이폰에 앱을 띄운다

```bash
git clone https://github.com/eunjch/hubparent.git hubfamily
cd hubfamily/webapp
npm install
npm run cap:sync          # ← 빠뜨리면 Xcode 빌드가 실패한다 (아래 함정 참고)
npm run cap:open:ios      # Xcode 로 mobile/ios/App/App.xcodeproj 열기
```

Xcode 에서:
1. 왼쪽에서 **App** 타깃 선택 → **Signing & Capabilities**
2. **Team** 에 사용자의 Apple Developer 팀 선택 (사용자에게 물어볼 것)
3. Bundle Identifier 가 `kr.co.mangotree.hubfamily` 인지 확인
4. `+ Capability` → **Push Notifications** 추가
5. `+ Capability` → **Background Modes** → **Remote notifications** 체크
6. 아이폰을 USB 로 연결하고 기기를 선택 → ▶ 실행
   (처음이면 아이폰에서 *설정 → 일반 → VPN 및 기기 관리* 에서 개발자를 신뢰해야 한다)

**여기서 확인할 것**: 앱이 뜨고, 첫 화면에서 자녀/부모 선택이 보이고, 로그인이 되고, 화면이
안드로이드와 똑같이 보이는가. 상태바에 화면이 겹치지 않는가.

계정은 사용자에게 물을 것. 운영 DB 에 시험용 가족이 있다:
자녀 `test-parent@example.com` / `medic1234!`, 부모는 자녀 이름 "김민수" + 번호로 들어간다.

### 2단계 — 애플 푸시 키 발급 (사용자가 해야 함)

developer.apple.com → Certificates, Identifiers & Profiles

1. **Identifiers** → App ID `kr.co.mangotree.hubfamily` 등록 → Push Notifications 체크
2. **Keys** → `+` → **Apple Push Notifications service (APNs)** → 생성 → `.p8` 다운로드
   - **한 번만 받을 수 있다.** 잃어버리면 키를 다시 만들어야 한다. 따로 보관하라고 안내할 것.
   - **Key ID** 는 키 이름 옆에 있다 (10자리)
   - **Team ID** 는 사이트 오른쪽 위 멤버십에 있다 (10자리)

### 3단계 — 서버에 키 올리기 (사용자가 실행)

사용자에게 아래를 알려주고 실행을 부탁할 것. 클로드가 직접 못 한다.

```bash
scp AuthKey_XXXXXXXX.p8 서버:/opt/hubfamily/deploy/apns-key.p8
```

`/opt/hubfamily/deploy/.env` 에:

```
APNS_KEY_PATH=/run/secrets/apns-key.p8
APNS_KEY_ID=XXXXXXXX          # 발급받은 Key ID
APNS_TEAM_ID=YYYYYYYYYY       # Team ID
APNS_TOPIC=kr.co.mangotree.hubfamily
APNS_SANDBOX=true             # Xcode 로 직접 설치해 시험하는 동안은 true
```

그리고 `cd /opt/hubfamily/deploy && ./deploy.sh`.

> `deploy.sh` 는 없는 키 파일 자리를 빈 파일로 만들어 둔다 (없는 파일을 bind mount 하면 도커가
> 디렉터리를 만들어 버린다). **빈 파일이 먼저 생겼다면 scp 전에 지워야 한다** — `rm apns-key.p8` 후 scp.

### 4단계 — 알림 시험

1. 아이폰에서 앱을 열고 **부모 계정으로 로그인** → 알림 권한 허용
   (토큰은 로그인 직후 `POST /devices` 로 올라간다 — `bridge.ts` 의 `afterLogin`)
2. 자녀 화면(웹 또는 다른 폰)에서 **3~4분 뒤 시각**으로 약을 하나 등록
3. **앱을 완전히 종료**하고 기다린다
4. 정해진 시각에서 1분 안에 알람음과 함께 알림이 와야 한다. 눌러서 `/s/med` 로 가는지도 볼 것

**소리가 안 나면 아이폰의 볼륨과 무음 스위치를 먼저 확인할 것.** 지금 구조는 무음 스위치를 못 뚫는다.

---

## 4. 함정 (미리 알고 갈 것)

| 증상 | 원인과 해결 |
|---|---|
| Xcode 빌드가 "Build input file cannot be found" 로 실패 | `capacitor.config.json`, `config.xml`, `public/` 은 git 에 없다(생성물). **`npm run cap:sync` 를 먼저 돌릴 것.** |
| 알림이 아예 안 옴 | 서버 `notification_logs` 에 이력이 남는다. 사용자에게 워커 로그를 받아 `event` 가 sent/failed/skipped 중 무엇인지 볼 것. `skipped` + "APNs 미설정" 이면 `.env` 나 키 파일 문제다 |
| 로그에 `BadDeviceToken` | sandbox/production 이 반대다. 서버가 자동으로 반대쪽에 한 번 더 보내니 알림 자체는 간다. 로그에 `APNs 토큰이 … 환경이었다` 가 보이면 `APNS_SANDBOX` 를 반대로 바꿀 것 |
| 알림은 오는데 기본음이 남 | 음원이 30초 이상이거나 번들에 없는 것이다. 테스트 `test_ios_alarm_sound_is_bundled_and_under_apple_limit` 가 지키지만, Xcode 에서 Target Membership 이 App 에 체크돼 있는지도 볼 것 |
| 앱은 켜져 있는데 알림이 조용함 | `capacitor.config.ts` 의 `presentationOptions` 에 alert/sound 가 들어 있다. 안 되면 여기부터 볼 것 |
| 사진 기능에서 앱이 죽음 | `Info.plist` 권한 문구 누락. 이미 넣어 뒀으니 지워지지 않았는지 확인 |

---

## 5. 끝나면

- `mobile/ios/` 변경분만 커밋한다. `git status` 로 안드로이드나 비밀 파일이 섞이지 않았는지 확인할 것.
- 커밋 메시지는 한국어, 무엇을 왜 했는지 적는다. 이 저장소의 기존 커밋 스타일을 따를 것.
- App Store 제출까지 간다면: 설명·데이터 안전 표는 `docs/store/PLAY_CONSOLE.md` 를 그대로 쓰되
  스크린샷 규격이 다르다 (6.9인치·6.5인치 각각 필요).

## 6. 더 읽을 것

- `mobile/README.md` — iOS 절에 같은 내용이 더 자세히 있다
- `docs/2026-09-01_HUB_FAMILY_개발계획서.md` 8.5 — 알림 설계와 그동안의 결정들
- `backend/app/services/apns.py` — 서버가 애플에 보내는 코드. 주석에 이유가 적혀 있다
