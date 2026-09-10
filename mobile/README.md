# mobile/ — 앱 껍데기 (Capacitor)

웹앱(`../webapp`)을 그대로 안드로이드/iOS 앱에 넣는다. 화면 코드는 한 줄도 다르지 않다.
앱에서만 도는 것은 알림·카메라 브릿지(`webapp/src/native/bridge.ts`) 뿐이다.

```
webapp/  ─ npm run build:app ─▶ dist/ ─ npx cap sync android ─▶ mobile/android/ ─ Android Studio ─▶ APK/AAB
```

## 준비물 (이 PC 기준, 2026-09-08 확인)

| 항목 | 위치 |
|---|---|
| Android Studio | `C:\Program Files\Android\Android Studio1` |
| Android SDK | `C:\Android\Sdk` (platform 36 · build-tools 36.0.0 설치됨) |
| **Java 21** | Android Studio 동봉 JBR `…\Android Studio1\jbr` — Capacitor 8 은 21 이 필요하다. 시스템 JDK 17 로는 빌드가 안 된다 |
| `google-services.json` | Firebase 프로젝트 `hubfamily-b1353` 의 안드로이드 앱 키. `mobile/android/app/` 에 넣는다. **git 에 올리지 않는다.** 없으면 `vite.config.ts` 가 `VITE_PUSH_ENABLED=false` 로 빌드해 푸시 코드를 아예 타지 않는다 — 없는 채로 `register()` 를 부르면 네이티브가 죽는다(2026-09-08 실기기에서 확인) |
| `deploy/firebase-adminsdk.json` | 서버 발송용 서비스 계정 키. 서버의 `/opt/hubfamily/deploy/` 에도 같은 이름으로 두고 `.env` 의 `FCM_CREDENTIALS_PATH=/run/secrets/firebase-adminsdk.json` |

## 빌드 · 실행

```powershell
cd webapp
npm run cap:sync            # 웹 빌드(API 절대주소 포함) + mobile/android 로 복사
npm run cap:open            # Android Studio 로 mobile/android 열기 → ▶ 실행
```

터미널만으로 APK 를 뽑을 때:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio1\jbr"
$env:ANDROID_HOME = "C:\Android\Sdk"
cd mobile\android
.\gradlew.bat assembleDebug           # → app\build\outputs\apk\debug\app-debug.apk
```

실기기 설치: USB 디버깅 켠 폰을 꽂고 `adb install -r app\build\outputs\apk\debug\app-debug.apk`

## API 주소

알림은 서버 푸시(FCM) 하나다. 로컬 알람은 같은 약이 두 번 울려 2026-09-09 에 뺐다 — `webapp/src/native/bridge.ts` 의 `clearLocalAlarms` 가 옛 예약을 지운다.

앱 안의 오리진은 `https://localhost` 라 상대 경로가 서버를 못 찾는다.
`npm run build:app` 이 `VITE_API_BASE_URL` 을 번들에 박는다 — 기본값은 `webapp/vite.config.ts` 의
`https://hubfamily.co.kr` (실도메인 · HTTPS, 2026-09-09). 다른 서버로 붙이려면:

```powershell
$env:VITE_API_BASE_URL = "https://…"; npm run cap:sync
```

## HTTPS

서버가 HTTPS 라 평문 허용(`cleartext`, `allowMixedContent`)은 두지 않는다. 안드로이드는 HTTP 를 기본 차단하므로
로컬 HTTP 서버에 붙여 테스트하려면 그때만 `capacitor.config.ts` 에 `server.cleartext: true` 를 잠시 넣는다.

## 아이콘 · 스플래시

`webapp/assets/{icon,icon-foreground,icon-background,splash}.png` 가 원본이다 (로고 SVG 에서 만든 1024px).
바꾸면 `cd webapp && npx @capacitor/assets generate --android --androidProject ../mobile/android` 로 다시 생성한다.

## iOS

`mobile/ios/` 는 이미 만들어져 있다 (2026-09-10, Windows 에서 `npx cap add ios`).
화면·브릿지 코드는 안드로이드와 한 줄도 다르지 않다. Capacitor 8 은 Swift Package Manager 를 써서
`pod install` 이 필요 없다 — Mac 에서 `App.xcodeproj` 를 열면 바로 빌드된다.

### 푸시는 애플로 직접 간다 (안드로이드와 다른 점)

Capacitor 푸시 플러그인은 iOS 에서 **APNs 토큰**을 준다 (플러그인 문서: "On iOS it contains the
APNS token"). FCM 은 이 토큰을 못 받는다. 그래서 안드로이드만 FCM 이고 iOS 는 서버가 애플에 직접 보낸다
(`backend/app/services/apns.py`). 앱은 이 때문에 고칠 것이 없다.

| | 안드로이드 | iOS |
|---|---|---|
| 경로 | 서버 → FCM → 폰 | 서버 → APNs → 폰 |
| 알람음 | 채널 `medication_alarm` 이 정함 (30초) | 알림마다 `medic_alarm.wav` 지정 (29초) |
| 세게 울리기 | 채널 importance 5 + USAGE_ALARM | `interruption-level: time-sensitive` |
| 서버 키 | `deploy/firebase-adminsdk.json` | `deploy/apns-key.p8` |

음원이 iOS 만 29초인 이유: 애플 제한이 "30초 **미만**" 이라 딱 30.0 초면 무시되고 기본음이 난다.
`mobile/ios/App/App/medic_alarm.wav` 는 Xcode 리소스로 등록돼 있고, 테스트가 길이와 등록 여부를 지킨다
(`test_ios_alarm_sound_is_bundled_and_under_apple_limit`).

무음 스위치까지 무시하려면 Critical Alerts 를 애플에 따로 신청해야 한다. 지금은 안 쓴다 —
time-sensitive 만으로 집중 모드는 뚫는다.

### Mac 에서 할 일

1. 저장소를 받고 웹 자산을 만든다
   ```bash
   cd webapp && npm install && npm run cap:sync    # ios 도 함께 동기화된다
   ```
2. **Firebase 는 iOS 에 필요 없다.** `GoogleService-Info.plist` 도, `google-services.json` 도
   Mac 에 없어도 된다. `VITE_PUSH_ENABLED` 는 안드로이드에서만 보는 값이다 (`bridge.ts`).
3. 애플 개발자 사이트 → Certificates, Identifiers & Profiles
   - **Identifiers** → App ID `kr.co.mangotree.hubfamily` 등록, Push Notifications 체크
   - **Keys** → `+` → Apple Push Notifications service (APNs) → 받은 `.p8` 저장 (**한 번만 받을 수 있다**)
   - Key ID 는 키 이름 옆, Team ID 는 오른쪽 위 멤버십에 있다
4. `.p8` 을 서버로 올린다
   ```bash
   scp AuthKey_XXXXXXXX.p8 서버:/opt/hubfamily/deploy/apns-key.p8
   # /opt/hubfamily/deploy/.env
   APNS_KEY_PATH=/run/secrets/apns-key.p8
   APNS_KEY_ID=XXXXXXXX
   APNS_TEAM_ID=YYYYYYYYYY
   APNS_TOPIC=kr.co.mangotree.hubfamily
   APNS_SANDBOX=true        # Xcode 로 폰에 직접 설치해 시험하는 동안
   ```
   그리고 `./deploy.sh`.
5. Xcode 로 `mobile/ios/App/App.xcodeproj` 를 열고
   - Signing & Capabilities → 팀 선택
   - `+ Capability` → **Push Notifications** 추가
   - `+ Capability` → **Background Modes** → Remote notifications 체크
     (`Info.plist` 에는 이미 들어 있지만 Xcode 가 entitlement 를 만들어야 한다)
6. 아이폰을 꽂고 ▶ 실행. 부모 계정으로 로그인하면 토큰이 서버에 올라간다.
7. 자녀 화면에서 몇 분 뒤 시각으로 약을 등록 → 앱을 끄고 기다린다. 알람음과 함께 와야 정상이다.

`APNS_SANDBOX` 를 잘못 둬도 서버가 알아서 반대쪽으로 한 번 더 보낸다. 로그에
`APNs 토큰이 … 환경이었다` 가 보이면 설정을 반대로 바꾸면 된다.

### 아이콘 · 스플래시

```bash
cd webapp && npx @capacitor/assets generate --ios --iosProject ../mobile/ios/App
```

### App Store 제출

`docs/store/PLAY_CONSOLE.md` 의 설명·데이터 안전 표를 그대로 쓰되, 스크린샷 규격이 다르다
(6.9인치·6.5인치 각각 필요). 심사는 구글보다 까다롭고 건강 앱은 더 본다.
