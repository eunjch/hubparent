/** 토큰 보관.
 *
 *  계획서 11장: 토큰은 Capacitor Secure Storage(안드로이드 Keystore · iOS Keychain)에
 *  보관하고 localStorage 는 쓰지 않는다.
 *
 *  아래 구현은 웹 개발용 폴백이다. Capacitor 플러그인을 붙이는 M1 에서
 *  이 두 함수의 내부만 교체하면 되도록 인터페이스를 좁게 유지한다.
 */

const ACCESS_KEY = "hf.access";
const REFRESH_KEY = "hf.refresh";

const memory: Record<string, string | null> = {
  [ACCESS_KEY]: null,
  [REFRESH_KEY]: null,
};

export async function getAccessToken(): Promise<string | null> {
  return memory[ACCESS_KEY];
}

export async function getRefreshToken(): Promise<string | null> {
  return memory[REFRESH_KEY];
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  memory[ACCESS_KEY] = access;
  memory[REFRESH_KEY] = refresh;
}

export async function clearTokens(): Promise<void> {
  memory[ACCESS_KEY] = null;
  memory[REFRESH_KEY] = null;
}
