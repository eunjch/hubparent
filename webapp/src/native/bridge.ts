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

/** 식사 사진 — 화면 S2 의 `사진 추가`.
 *
 *  권한은 **이 함수를 부를 때** 요청한다. 앱 진입 시 미리 묻지 않는다.
 *  사진은 선택 항목이라 거부당해도 식사 체크는 정상으로 끝나야 한다 (계획서 8.5.8).
 *
 *  웹에서는 <input type="file" capture> 로 대신한다. 앱에서는 M2 말에
 *  @capacitor/camera 를 붙여 촬영·앨범 선택을 고를 수 있게 한다.
 */
export async function pickMealPhoto(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    // 어르신은 대개 방금 먹은 것을 찍는다. 카메라를 먼저 연다.
    input.capture = "environment";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
