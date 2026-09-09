/** 복약 알람 채널 — 안드로이드 네이티브 (mobile/android/.../AlarmChannelPlugin.java).
 *
 *  시계 앱처럼 울리게 하는 건 채널 속성(USAGE_ALARM)뿐이라 플러그인은 ensure() 하나다.
 *  웹·iOS 에서는 아무것도 하지 않는다.
 */

import { registerPlugin } from "@capacitor/core";

export interface AlarmChannelPlugin {
  ensure(): Promise<{ id: string }>;
}

export const AlarmChannel = registerPlugin<AlarmChannelPlugin>("AlarmChannel", {
  web: () => Promise.resolve({ ensure: async () => ({ id: "medication_alarm" }) }),
});

/** 서버가 주는 채널 이름 → 단말 채널 ID. 복약만 알람 채널로 보낸다 (일정·요약은 일반 알림). */
export const ALARM_CHANNEL_ID = "medication_alarm";

export function channelIdFor(channel: string): string {
  return channel === "medication" ? ALARM_CHANNEL_ID : channel;
}
