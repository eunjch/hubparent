/** Capacitor 네이티브 브릿지 래퍼.
 *
 *  플러그인 호출을 여기 한 곳에 모아 둔다. 웹(브라우저)에서는 안전한 기본값을 돌려주고,
 *  앱에서만 실제 플러그인을 쓴다. 화면 코드는 앱인지 웹인지 몰라도 된다.
 *
 *  알림은 서버 푸시 하나다 (2026-09-09 결정). 로컬 알람은 두 번 울리는 문제로 뺐다.
 */

import { App } from "@capacitor/app";
import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";

import { request } from "../shared/api";
import type { Role } from "../shared/types";

import { AlarmChannel } from "./alarm-channel";

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function platform(): "android" | "ios" | "web" {
  const value = Capacitor.getPlatform();
  return value === "android" || value === "ios" ? value : "web";
}

/** 보호자에게 바로 전화를 건다. 중간 확인 단계를 두지 않는다 (계획서 9장). */
export function call(phone: string): void {
  window.location.href = `tel:${phone}`;
}

/* ── 알림 채널 (계획서 8.5.7) ────────────────────────────────
 *  채널은 한 번 만들면 사용자가 끌 수 있고 앱이 되돌릴 수 없다.
 *  처음부터 나눠야 "하루 요약만 끄고 약 알림은 켜두기" 가 된다. */
/* sound 를 비우면 시스템 기본 알림음이다. "default" 라고 쓰면 앱 안의 raw/default 파일을
 * 찾아 무음이 된다 — 실기기에서 확인한 함정. */
const CHANNELS = [
  { id: "medication", name: "약 복용 알림", importance: 5 as const, vibration: true },
  { id: "anomaly", name: "이상 징후", importance: 5 as const, vibration: true },
  { id: "schedule", name: "일정", importance: 3 as const, vibration: false },
  { id: "report", name: "하루 요약", importance: 2 as const, vibration: false },
];

/* 채널은 한 번 만들면 앱이 못 바꾼다 — 같은 ID 로 지웠다 다시 만들어도 이전 설정이 복원된다
 * (실기기 확인). 정의를 바꿔야 하면 ID 자체를 바꿔야 한다. createChannel 은 멱등이라 매번 불러도 된다. */
async function ensureChannels(): Promise<void> {
  if (platform() !== "android") return;
  for (const ch of CHANNELS) {
    await LocalNotifications.createChannel({ ...ch, visibility: 1 });
  }
  // 복약은 알람 채널(USAGE_ALARM · 30초 알람음) — 네이티브에서 만든다
  await AlarmChannel.ensure().catch(() => undefined);
}

/* ── 푸시 (계획서 8.5.1) ─────────────────────────────────── */

let pushListenersBound = false;

/** 권한을 묻고 FCM 토큰을 받아 서버에 올린다. 첫 로그인 직후 한 번 부른다 (8.5.8).
 *  거부하면 null — 화면이 "알림이 꺼져 있어요" 를 보여 줄 수 있다. */
export async function registerPush(): Promise<string | null> {
  if (!isNativeApp()) return null;
  // 안드로이드는 google-services.json 없이 register() 를 부르면 네이티브가 죽는다 (vite.config 에서 정해진다).
  // iOS 는 Firebase 를 안 타고 애플에 바로 등록하므로 이 확인이 필요 없다 — 서버가 APNs 로 직접 보낸다.
  if (platform() === "android" && !import.meta.env.VITE_PUSH_ENABLED) return null;

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") {
    // 거부해도 그 사실을 남긴다. 예전에는 아무것도 올리지 않아 복약 알림이 안 울리는
    // 것을 자녀도 부모님도 모른 채 지냈다 (계획서 8.5.8 · 2026-09-11 점검).
    await reportPermission(false);
    return null;
  }

  await ensureChannels();

  return new Promise((resolve) => {
    let settled = false;
    const done = (token: string | null) => {
      if (settled) return;
      settled = true;
      resolve(token);
    };

    if (!pushListenersBound) {
      pushListenersBound = true;
      void PushNotifications.addListener("registration", async ({ value }) => {
        try {
          await request("/devices", {
            method: "POST",
            body: {
              platform: platform(),
              push_token: value,
              app_version: APP_VERSION,
              notifications_granted: true,
            },
          });
        } catch {
          /* 다음 앱 실행 때 다시 올린다 */
        }
        done(value);
      });
      void PushNotifications.addListener("registrationError", () => done(null));
      // 푸시를 눌러 들어오면 payload 의 route 로 간다 (8.5.9)
      void PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const route = (notification.data as { route?: string } | undefined)?.route;
        if (route) navigateTo(route);
      });
    }

    void PushNotifications.register();
    // 토큰이 끝내 안 오면 화면을 붙들지 않는다
    setTimeout(() => done(null), 8000);
  });
}

/** 알림 권한 상태를 서버에 남긴다. 토큰이 없어도 행은 만들어진다. */
async function reportPermission(granted: boolean): Promise<void> {
  try {
    await request("/devices", {
      method: "POST",
      body: { platform: platform(), app_version: APP_VERSION, notifications_granted: granted },
    });
  } catch {
    /* 다음 실행 때 다시 올린다 */
  }
}

/** 지금 알림이 켜져 있는가. 화면이 배너를 띄울지 정하는 데 쓴다. */
export async function notificationsEnabled(): Promise<boolean> {
  if (!isNativeApp()) return true; // 웹에서는 배너를 띄우지 않는다
  try {
    const perm = await PushNotifications.checkPermissions();
    return perm.receive === "granted";
  } catch {
    return true;
  }
}

/* ── 로컬 알람은 쓰지 않는다 (2026-09-09 결정) ─────────────────
 *  같은 약이 로컬·푸시로 두 번 울리는 문제로 서버 푸시 하나로 통일했다.
 *  예전 버전이 폰에 걸어 둔 알람이 남아 있을 수 있어 로그인 때 전부 지운다. */
async function clearLocalAlarms(): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
  } catch {
    /* 권한이 없거나 플러그인이 없는 환경 — 지울 것도 없다 */
  }
}

/* ── 앱 생명주기 ────────────────────────────────────────────── */

let navigate: ((route: string) => void) | null = null;

/** App.tsx 가 라우터의 navigate 를 넘겨준다. 알림을 눌러 들어올 때 쓴다. */
export function bindNavigator(fn: (route: string) => void): void {
  navigate = fn;
}

function navigateTo(route: string): void {
  if (navigate) navigate(route);
  else window.location.href = route;
}

/** 앱이 다시 앞으로 올 때마다 (하트비트). */
export function onResume(fn: () => void): () => void {
  if (!isNativeApp()) return () => undefined;
  const handle = App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) fn();
  });
  return () => {
    void handle.then((h) => h.remove());
  };
}

/** 안드로이드 뒤로가기 — 첫 화면에서는 앱을 내린다, 그 밖에는 라우터 뒤로. */
export function bindBackButton(canGoBack: () => boolean, goBack: () => void): () => void {
  if (platform() !== "android") return () => undefined;
  const handle = App.addListener("backButton", () => {
    if (canGoBack()) goBack();
    else void App.exitApp();
  });
  return () => {
    void handle.then((h) => h.remove());
  };
}

/** 로그인 직후 한 번. 푸시 토큰 등록 + 옛 로컬 알람 정리. */
export async function afterLogin(_role: Role): Promise<void> {
  if (!isNativeApp()) return;
  await clearLocalAlarms();
  await registerPush().catch(() => undefined);
}

/* ── 사진 (계획서 8.5.8) ───────────────────────────────────── */

/** 식사 사진 — 화면 S2 의 `사진 추가`.
 *
 *  권한은 **이 함수를 부를 때** 요청한다. 앱 진입 시 미리 묻지 않는다.
 *  사진은 선택 항목이라 거부당해도 식사 체크는 정상으로 끝나야 한다.
 *  앱에서는 촬영/앨범을 고르게 하고, 웹에서는 <input type="file" capture> 로 대신한다.
 */
export async function pickMealPhoto(source: "camera" | "gallery" = "camera"): Promise<File | null> {
  if (isNativeApp()) {
    try {
      // 앱은 파일 경로(uri)를 준다. 업로드 API 는 File 을 받으니 한 번 읽어서 감싼다
      const result =
        source === "camera"
          ? await Camera.takePhoto({
              quality: 80,
              targetWidth: 1280,
              targetHeight: 1280,
              correctOrientation: true,
            })
          : (
              // 앨범 원본은 3~8MB 다. 줄이지 않으면 LTE 에서 올리다 끊긴다 (2026-09-11 재점검)
              await Camera.chooseFromGallery({
                allowMultipleSelection: false,
                limit: 1,
                quality: 80,
                targetWidth: 1280,
                targetHeight: 1280,
              })
            ).results[0];
      const webPath = result?.uri ? Capacitor.convertFileSrc(result.uri) : undefined;
      const format = result?.uri?.split(".").pop()?.toLowerCase() || "jpg";
      if (!webPath) return null;
      const blob = await (await fetch(webPath)).blob();
      return new File([blob], `meal.${format}`, { type: blob.type || "image/jpeg" });
    } catch {
      // 취소 또는 권한 거부 — 둘 다 "사진 없이 진행" 이다
      return null;
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    // 어르신은 대개 방금 먹은 것을 찍는다. 카메라를 먼저 연다.
    if (source === "camera") input.capture = "environment";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** TODO(M5): 화면 켜짐·걸음 수·조도·배터리 수집. 안드로이드는 WorkManager 주기 작업. */
export async function collectSignals(): Promise<never[]> {
  return [];
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.1.0";
