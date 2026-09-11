/** 토큰 보관과 세션 상태.
 *
 *  계획서 11장: 토큰은 Capacitor Secure Storage(안드로이드 Keystore · iOS Keychain)에
 *  보관한다. 아래는 웹 개발용 폴백이며, 앱 빌드 시 이 파일의 내부만 교체하면 되도록
 *  읽기/쓰기 지점을 좁게 유지한다.
 *
 *  어르신은 재로그인 화면을 보면 그 시점에 이탈한다(계획서 1.4). 그래서
 *  refresh 토큰을 길게(180일) 잡고, 앱을 열 때마다 조용히 갱신한다.
 */

import { BASE_URL } from "./base";

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

/** 세션이 끊어졌을 때 화면이 반응할 수 있게 알린다 (App.tsx 가 첫 화면으로 보낸다). */
type Listener = () => void;
const lost: Listener[] = [];

export function onSessionLost(fn: Listener): () => void {
  lost.push(fn);
  return () => {
    const i = lost.indexOf(fn);
    if (i >= 0) lost.splice(i, 1);
  };
}

/** access 가 만료됐으면 refresh 로 조용히 갱신한다.
 *
 *  api.ts 의 request() 를 쓰지 않고 직접 부른다 — 401 재시도가 여기로 들어오므로
 *  서로를 부르면 무한히 돈다. 동시에 여러 요청이 401 을 받아도 갱신은 한 번만 돈다.
 */
let inFlight: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const refresh = read(REFRESH_KEY);
    if (!refresh) return false;
    try {
      const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) {
        // 만료·폐기된 refresh 다. 통신 오류는 여기로 오지 않는다(fetch 가 throw)
        await clearTokens();
        lost.forEach((fn) => fn());
        return false;
      }
      const tokens = (await res.json()) as { access_token: string; refresh_token: string };
      await saveTokens(tokens.access_token, tokens.refresh_token);
      return true;
    } catch {
      // 통신이 안 되는 것뿐이다. 토큰은 남겨 둔다 — 지하철에서 로그아웃되면 안 된다
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
