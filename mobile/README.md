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
| `google-services.json` | `mobile/android/app/` 에 넣는다. **git 에 올리지 않는다.** 없으면 `vite.config.ts` 가 `VITE_PUSH_ENABLED=false` 로 빌드해 푸시 코드를 아예 타지 않는다 — 없는 채로 `register()` 를 부르면 네이티브가 죽는다(2026-09-08 실기기에서 확인) |

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

앱 안의 오리진은 `https://localhost` 라 상대 경로가 서버를 못 찾는다.
`npm run build:app` 이 `VITE_API_BASE_URL` 을 번들에 박는다 — 기본값은 `webapp/vite.config.ts` 의
`http://hubfamily.mangotree.co.kr`. 다른 서버로 붙이려면:

```powershell
$env:VITE_API_BASE_URL = "https://…"; npm run cap:sync
```

## HTTPS 전환 시 되돌릴 것

지금은 서버가 HTTP 라 평문 통신을 열어 두었다. 인증서가 붙으면:

- `webapp/capacitor.config.ts` — `server.cleartext: true`, `android.allowMixedContent: true` 제거
- `webapp/vite.config.ts` — 기본 주소를 `https://` 로

## 아이콘 · 스플래시

`webapp/assets/{icon,icon-foreground,icon-background,splash}.png` 가 원본이다 (로고 SVG 에서 만든 1024px).
바꾸면 `cd webapp && npx @capacitor/assets generate --android --androidProject ../mobile/android` 로 다시 생성한다.

## iOS

Mac + Xcode 에서 `cd webapp && npx cap add ios` → `mobile/ios/` 가 생긴다. 같은 브릿지 코드가 그대로 돈다.
APNs 인증키(.p8)를 Firebase 에 등록해야 iOS 푸시가 간다.
