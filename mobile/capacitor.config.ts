import type { CapacitorConfig } from "@capacitor/cli";

/** 웹앱은 원격 URL 로딩이 아니라 정적 번들로 앱 안에 동봉한다 — 계획서 3장.
 *  스토어의 "단순 웹뷰" 반려 리스크와 오프라인 실패를 줄이기 위함이다.
 *  webDir 은 webapp 의 빌드 산출물을 가리킨다. */
const config: CapacitorConfig = {
  appId: "kr.co.mangotree.hubfamily",
  appName: "허브패밀리",
  webDir: "../webapp/dist",

  android: {
    // 고령자 단말에서 시스템 글자 크기 설정을 웹뷰가 따라가게 한다 (계획서 9장)
    allowMixedContent: false,
  },

  server: {
    androidScheme: "https",
  },

  plugins: {
    // TODO(M3): PushNotifications 등록
    // TODO(M5): 백그라운드 생활 신호 수집 (WorkManager 연동)
  },
};

export default config;
