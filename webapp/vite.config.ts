import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 개발 서버(:5173)와 미리보기(:4173)에서 /api 요청을 로컬 API 컨테이너로 넘긴다.
// 운영에서는 아파치가 같은 일을 한다 — 덕분에 코드에서는 항상 상대 경로를 쓴다.
const API_TARGET = process.env.VITE_DEV_API_TARGET ?? "http://127.0.0.1:8000";
const proxy = { "/api": { target: API_TARGET, changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
