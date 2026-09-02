/** 토큰 보관과 세션 상태.
 *
 *  계획서 11장: 토큰은 Capacitor Secure Storage(안드로이드 Keystore · iOS Keychain)에
 *  보관한다. 아래는 웹 개발용 폴백이며, 앱 빌드 시 이 파일의 내부만 교체하면 되도록
 *  읽기/쓰기 지점을 좁게 유지한다.
 *
 *  어르신은 재로그인 화면을 보면 그 시점에 이탈한다(계획서 1.4). 그래서
 *  refresh 토큰을 길게(180일) 잡고, 앱을 열 때마다 조용히 갱신한다.
 */

import { request } from "./api";

const ACCESS_KEY = "hf.access";
const REFRESH_KEY = "hf.refresh";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 저장이 막힌 환경(사생활 보호 모드 등)에서도 화면은 동작해야 한다 */
  }
}

export async function getAccessToken(): Promise<string | null> {
  return read(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return read(REFRESH_KEY);
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  write(ACCESS_KEY, access);
  write(REFRESH_KEY, refresh);
}

export async function clearTokens(): Promise<void> {
  write(ACCESS_KEY, null);
  write(REFRESH_KEY, null);
}

export function hasSession(): boolean {
  return read(ACCESS_KEY) !== null;
}

/** 앱 진입 시 1회. access 가 만료됐으면 refresh 로 조용히 갱신한다. */
export async function refreshSession(): Promise<boolean> {
  const refresh = read(REFRESH_KEY);
  if (!refresh) return false;

  try {
    const tokens = await request<{ access_token: string; refresh_token: string }>(
      "/auth/refresh",
      { method: "POST", body: { refresh_token: refresh } },
    );
    await saveTokens(tokens.access_token, tokens.refresh_token);
    return true;
  } catch {
    await clearTokens();
    return false;
  }
}
