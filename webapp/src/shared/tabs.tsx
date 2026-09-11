/** 하단 탭바 — 역할별로 하나씩. 탭마다 화면이 따로 있어 경로로 오간다.
 *
 *  어르신: 홈 · 건강기록 · 일정 · 더보기
 *  자녀:   홈 · 리포트 · 메시지 · 더보기
 */

import { useNavigate } from "react-router-dom";

import { TabBar } from "./ui";

export type SeniorTab = "home" | "record" | "schedule" | "more";
export type GuardianTab = "home" | "report" | "alerts" | "more";

export function SeniorTabs({ current }: { current: SeniorTab }) {
  const nav = useNavigate();
  return (
    <TabBar
      current={current}
      items={[
        { key: "home", icon: "home", label: "홈", onClick: () => nav("/s/home") },
        { key: "record", icon: "report", label: "건강기록", onClick: () => nav("/s/record") },
        { key: "schedule", icon: "calendar", label: "일정", onClick: () => nav("/s/schedule") },
        { key: "more", icon: "grid", label: "더보기", onClick: () => nav("/s/more") },
      ]}
    />
  );
}

export function GuardianTabs({ current }: { current: GuardianTab }) {
  const nav = useNavigate();
  return (
    <TabBar
      current={current}
      items={[
        { key: "home", icon: "home", label: "홈", onClick: () => nav("/g/home") },
        { key: "report", icon: "report", label: "리포트", onClick: () => nav("/g/report") },
        // 메시지 기능은 없다. 있지도 않은 것을 기대하게 만들지 않는다 (2026-09-11 점검)
        { key: "alerts", icon: "message", label: "알림", onClick: () => nav("/g/alerts") },
        { key: "more", icon: "grid", label: "더보기", onClick: () => nav("/g/more") },
      ]}
    />
  );
}

/** "9월 8일 (화)" */
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const week = ["일", "월", "화", "수", "목", "금", "토"][dt.getDay()];
  return `${m}월 ${d}일 (${week})`;
}

/** 로컬 날짜 YYYY-MM-DD. 자정 근처에 UTC 로 밀리지 않게 로컬로 만든다. */
export function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
