/** Capacitor 네이티브 브릿지 래퍼.
 *
 *  플러그인 호출을 여기 한 곳에 모아 둔다. 웹(개발 중)에서는 안전한 기본값을 돌려주고,
 *  앱에서만 실제 플러그인을 쓴다. 플러그인 설치는 M3(푸시)·M5(센서)에서 한다.
 */

export function isNativeApp(): boolean {
  return typeof (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    ?.isNativePlatform === "function";
}

export function platform(): "android" | "ios" | "web" {
  const cap = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const value = cap?.getPlatform?.() ?? "web";
  return value === "android" || value === "ios" ? value : "web";
}

/** 보호자에게 바로 전화를 건다 — 화면 10. 중간 확인 단계를 두지 않는다 (계획서 9장). */
export function call(phone: string): void {
  window.location.href = `tel:${phone}`;
}

/** TODO(M3): @capacitor/push-notifications 등록 후 서버에 토큰을 올린다. */
export async function registerPush(): Promise<string | null> {
  return null;
}

/** TODO(M5): 화면 켜짐·걸음 수·조도·배터리 수집. 안드로이드는 WorkManager 주기 작업. */
export async function collectSignals(): Promise<never[]> {
  return [];
}
