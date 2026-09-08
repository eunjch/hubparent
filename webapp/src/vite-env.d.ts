/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_VERSION?: string;
  /** 빌드 시 google-services.json 유무로 정해진다 (vite.config.ts) */
  readonly VITE_PUSH_ENABLED: boolean;
}
