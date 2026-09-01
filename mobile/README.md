# mobile — Capacitor 앱 셸

웹 UI 한 벌을 `android/`, `ios/` 두 네이티브 프로젝트에 담는다.
두 프로젝트는 각각 따로 빌드·심사·출시한다.

## 최초 설정

```bash
npm install
npm run build:web          # webapp/dist 생성 (webDir 대상)
npx cap add android        # android/ 생성
```

iOS 는 M6 이후에 붙인다.

```bash
npx cap add ios
```

## 개발 흐름

웹 코드를 고친 뒤 네이티브 프로젝트로 복사한다.

```bash
npm run sync               # webapp 빌드 + cap sync
npm run open:android       # Android Studio 열기
```

## 필요한 것

- JDK 17
- Android Studio (SDK 35)
- iOS 는 macOS + Xcode + Apple 개발자 계정(연 $99)

## 주의

`android/`, `ios/` 는 저장소에 커밋한다. 다만 서명 키와 Firebase 설정 파일은 제외한다
(루트 `.gitignore` 참고): `*.keystore`, `google-services.json`, `GoogleService-Info.plist`
