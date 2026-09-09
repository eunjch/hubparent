/** Capacitor — 웹앱을 앱 껍데기에 넣는다 (계획서 3장 · 8.5.13).
 *
 *  네이티브 프로젝트는 계획서 4.1 의 모노레포 구조대로 ../mobile/ 아래에 둔다.
 *  빌드:  npm run build:app && npx cap sync android  →  Android Studio 에서 mobile/android 열기
 */

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "kr.co.mangotree.hubfamily",
  appName: "허브패밀리",
  webDir: "dist",

  android: {
    path: "../mobile/android",
  },
  ios: {
    path: "../mobile/ios",
  },

  server: {
    // 앱 안의 오리진. API 는 VITE_API_BASE_URL 로 절대 주소를 쓴다 (shared/api.ts)
    // 서버가 https://hubfamily.co.kr 이라 평문 허용은 두지 않는다
    androidScheme: "https",
  },

  plugins: {
    PushNotifications: {
      // 앱이 켜져 있을 때 온 푸시도 상단에 띄운다 — 어르신은 앱을 열어둔 채 두는 일이 많다
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_notify",
      iconColor: "#8D86F7",
    },
  },
};

export default config;
