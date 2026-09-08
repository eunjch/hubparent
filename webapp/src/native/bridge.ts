/** Capacitor 네이티브 브릿지 래퍼.
 *
 *  플러그인 호출을 여기 한 곳에 모아 둔다. 웹(브라우저)에서는 안전한 기본값을 돌려주고,
 *  앱에서만 실제 플러그인을 쓴다. 화면 코드는 앱인지 웹인지 몰라도 된다.
 *
 *  알림 원칙 (계획서 8.5): 푸시가 주, 로컬은 통신이 끊겼을 때의 보험.
 *  둘 다 건다. 중복 방지 장치는 두지 않는다.
 */

import { App } from "@capacitor/app";
import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";

import { request } from "../shared/api";
import type { Role } from "../shared/types";

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
}

/* ── 푸시 (계획서 8.5.1) ─────────────────────────────────── */

let pushListenersBound = false;

/** 권한을 묻고 FCM 토큰을 받아 서버에 올린다. 첫 로그인 직후 한 번 부른다 (8.5.8).
 *  거부하면 null — 화면이 "알림이 꺼져 있어요" 를 보여 줄 수 있다. */
export async function registerPush(): Promise<string | null> {
  if (!isNativeApp()) return null;
  // google-services.json 없이 register() 를 부르면 네이티브가 죽는다. 빌드 때 정해진다 (vite.config)
  if (!import.meta.env.VITE_PUSH_ENABLED) return null;

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return null;

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
            body: { platform: platform(), push_token: value, app_version: APP_VERSION },
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

/* ── 로컬 알림 (계획서 8.5.4 · 8.5.5) ───────────────────────
 *  서버가 2주치 계획과 int ID 를 준다. 받은 대로 예약하고 결과를 보고한다. */

interface PlanItem {
  local_id: number;
  at: string;
  title: string;
  body: string;
  channel: string;
  route: string;
}

interface Plan {
  items: PlanItem[];
  revoked_ids: number[];
}

let localListenerBound = false;

export async function syncLocalNotifications(): Promise<number> {
  if (!isNativeApp()) return 0;

  let perm = await LocalNotifications.checkPermissions();
  if (perm.display === "prompt" || perm.display === "prompt-with-rationale") {
    perm = await LocalNotifications.requestPermissions();
  }
  if (perm.display !== "granted") return 0;

  await ensureChannels();

  const plan = await request<Plan>("/notifications/plan?days=14");
  const now = new Date().toISOString();
  const events: { local_id: number; event: "scheduled" | "canceled"; at: string }[] = [];

  // 취소분 + 이미 걸려 있는 것 전부 지우고 다시 건다 — 상태를 맞추는 가장 단순한 길
  const pending = await LocalNotifications.getPending();
  const toCancel = [
    ...pending.notifications.map((n) => ({ id: n.id })),
    ...plan.revoked_ids.map((id) => ({ id })),
  ];
  if (toCancel.length > 0) {
    await LocalNotifications.cancel({ notifications: toCancel });
    for (const id of plan.revoked_ids) events.push({ local_id: id, event: "canceled", at: now });
  }

  const future = plan.items.filter((it) => new Date(it.at).getTime() > Date.now());
  if (future.length > 0) {
    await LocalNotifications.schedule({
      notifications: future.map((it) => ({
        id: it.local_id,
        title: it.title,
        body: it.body,
        channelId: it.channel,
        // Doze 상태에서도 정각에 울린다 (8.5.4)
        schedule: { at: new Date(it.at), allowWhileIdle: true },
        extra: { route: it.route },
      })),
    });
    for (const it of future) events.push({ local_id: it.local_id, event: "scheduled", at: now });
  }

  if (!localListenerBound) {
    localListenerBound = true;
    void LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
      void request("/notifications/report", {
        method: "POST",
        body: { events: [{ local_id: notification.id, event: "fired", at: new Date().toISOString() }] },
      }).catch(() => undefined);
      const route = (notification.extra as { route?: string } | undefined)?.route;
      if (route) navigateTo(route);
    });
  }

  if (events.length > 0) {
    await request("/notifications/report", { method: "POST", body: { events } }).catch(() => undefined);
  }
  return future.length;
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

/** 앱이 다시 앞으로 올 때마다 (하트비트 + 로컬 알림 재동기화). */
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

/** 로그인 직후 한 번. 푸시 등록 → 어르신이면 로컬 알림 2주치 예약. */
export async function afterLogin(role: Role): Promise<void> {
  if (!isNativeApp()) return;
  // 로컬 예약이 먼저다 — Firebase 가 없어도 이건 되어야 한다 (계획서 8.5: 로컬은 보험)
  if (role === "senior") {
    await syncLocalNotifications().catch(() => undefined);
  }
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
          : (await Camera.chooseFromGallery({ allowMultipleSelection: false, limit: 1 })).results[0];
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
