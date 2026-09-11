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
 *
 *  세 가지를 지킨다.
 *   - **끝나면 반드시 잠금을 푼다.** 예전에는 토큰이 없을 때 try 밖에서 빠져나가
 *     finally 를 안 타는 바람에, 한 번 그 경로를 밟으면 앱을 죽일 때까지 갱신이
 *     영영 되지 않았다 (2026-09-11 재점검).
 *   - **401 일 때만 토큰을 지운다.** 502·503 은 fetch 가 던지지 않고 그냥 응답으로 온다.
 *     배포 중 잠깐 503 이 났다고 부모님을 로그아웃시키면 혼자 돌아오지 못한다.
 *   - **시간 제한을 둔다.** 여기서 매달리면 401 을 받은 모든 화면이 함께 멈춘다.
 */
let inFlight: Promise<boolean> | null = null;

const REFRESH_TIMEOUT_MS = 10_000;

async function doRefresh(): Promise<boolean> {
  const refresh = read(REFRESH_KEY);
  if (!refresh) return false;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REFRESH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      signal: ctrl.signal,
    });
    if (res.ok) {
      const tokens = (await res.json()) as { access_token: string; refresh_token: string };
      await saveTokens(tokens.access_token, tokens.refresh_token);
      return true;
    }
    if (res.status === 401) {
      // 만료·폐기된 refresh 다. 이때만 세션을 접는다
      await clearTokens();
      lost.forEach((fn) => fn());
    }
    // 500·502·503 은 서버가 잠깐 아픈 것이다. 토큰은 그대로 둔다
    return false;
  } catch {
    // 통신이 안 되거나 시간이 다 됐다. 토큰은 남겨 둔다 — 지하철에서 로그아웃되면 안 된다
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshSession(): Promise<boolean> {
  if (inFlight) return inFlight;
  // 잠금 해제를 호출부 바깥에서 확실히 한다. 안쪽 early return 에 기대지 않는다
  inFlight = doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
