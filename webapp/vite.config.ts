import { existsSync } from "node:fs";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 개발 서버(:5173)와 미리보기(:4173)에서 /api 요청을 로컬 API 컨테이너로 넘긴다.
// 운영에서는 아파치가 같은 일을 한다 — 덕분에 코드에서는 항상 상대 경로를 쓴다.
const API_TARGET = process.env.VITE_DEV_API_TARGET ?? "http://127.0.0.1:8000";
const proxy = {
  "/api": { target: API_TARGET, changeOrigin: true },
  "/uploads": { target: API_TARGET, changeOrigin: true },
};

// 앱 빌드(--mode app)에서만 API 절대 주소를 박는다. 앱 오리진은 https://localhost 라
// 상대 경로가 서버를 못 찾는다. HTTPS 가 붙으면 기본값을 https 로 바꾼다.
const APP_API_BASE = process.env.VITE_API_BASE_URL ?? "http://hubfamily.mangotree.co.kr";

// 푸시는 google-services.json 이 있을 때만 켠다. 없는 채로 register() 를 부르면
// 네이티브에서 "Default FirebaseApp is not initialized" 로 앱이 죽는다 — JS 로는 못 막는다.
const HAS_FIREBASE = existsSync(new URL("../mobile/android/app/google-services.json", import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  define:
    mode === "app"
      ? {
          "import.meta.env.VITE_API_BASE_URL": JSON.stringify(APP_API_BASE),
          "import.meta.env.VITE_PUSH_ENABLED": JSON.stringify(HAS_FIREBASE),
        }
      : { "import.meta.env.VITE_PUSH_ENABLED": "false" },
}));
