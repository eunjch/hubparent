/** 아이콘 — CONCEPT 4 시안의 일러스트 톤을 SVG 로 옮긴 것.
 *
 *  시안의 캐릭터 일러스트(사람이 등장하는 그림)는 별도 산출물이라 여기 없다.
 *  대신 사물 아이콘은 같은 톤 — 둥근 형태, 부드러운 색, 얇은 외곽선 — 으로 직접 그린다.
 *  일러스트를 받으면 이 컴포넌트들을 <img> 로 바꾸면 된다.
 *
 *  모두 장식용이므로 aria-hidden 이다. 의미는 항상 옆의 글자가 전달한다(계획서 9장).
 */

type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 48 48",
  fill: "none" as const,
  "aria-hidden": true,
  focusable: "false" as const,
});

/** 식사 — 초록 그릇에 담긴 밥 */
export function IconMeal({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)}>
      <ellipse cx="24" cy="20" rx="15" ry="6" fill="#FFFDF6" stroke="#4A7D38" strokeWidth="1.6" />
      <circle cx="19" cy="18.5" r="2.4" fill="#F2A65A" />
      <circle cx="27.5" cy="19" r="2.1" fill="#7FBF5F" />
      <circle cx="23" cy="17" r="1.8" fill="#E8705F" />
      <path
        d="M9 21c0 7.7 6.7 13 15 13s15-5.3 15-13z"
        fill="#5FA84B"
        stroke="#3E6B31"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M13 24.5c1.2 4 5.6 6.6 11 6.6" stroke="#A6D98F" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 36h36" stroke="#3E6B31" strokeWidth="2.2" strokeLinecap="round" opacity=".28" />
    </svg>
  );
}

/** 약 복용 — 기울어진 캡슐 */
export function IconMed({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)}>
      <g transform="rotate(-38 24 24)">
        <rect x="9" y="17" width="30" height="14" rx="7" fill="#FFFFFF" stroke="#2F6F9E" strokeWidth="1.7" />
        <path d="M24 17h8a7 7 0 0 1 0 14h-8z" fill="#4FA3E3" stroke="#2F6F9E" strokeWidth="1.7" />
        <path d="M13.5 21.5a4 4 0 0 1 3-2.6" stroke="#CBE6FA" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** 기분 — 웃는 얼굴 */
export function IconMood({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="24" cy="24" r="15" fill="#FFD85E" stroke="#C79512" strokeWidth="1.7" />
      <circle cx="18.5" cy="21" r="2.1" fill="#4A3A10" />
      <circle cx="29.5" cy="21" r="2.1" fill="#4A3A10" />
      <path d="M17 28.5c1.9 2.6 4.3 3.9 7 3.9s5.1-1.3 7-3.9" stroke="#4A3A10" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="13.5" cy="26.5" r="2.4" fill="#F5927E" opacity=".55" />
      <circle cx="34.5" cy="26.5" r="2.4" fill="#F5927E" opacity=".55" />
    </svg>
  );
}

/** 일정 — 달력 */
export function IconPlan({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="7" y="11" width="34" height="30" rx="5" fill="#FFFFFF" stroke="#C4566A" strokeWidth="1.7" />
      <path d="M7 16a5 5 0 0 1 5-5h24a5 5 0 0 1 5 5v3H7z" fill="#EE7C8C" />
      <rect x="14" y="6" width="3.6" height="8" rx="1.8" fill="#C4566A" />
      <rect x="30.4" y="6" width="3.6" height="8" rx="1.8" fill="#C4566A" />
      <g fill="#F2A9B4">
        <rect x="12" y="24" width="5" height="4.6" rx="1.4" />
        <rect x="21.5" y="24" width="5" height="4.6" rx="1.4" />
        <rect x="31" y="24" width="5" height="4.6" rx="1.4" />
        <rect x="12" y="31.5" width="5" height="4.6" rx="1.4" />
        <rect x="21.5" y="31.5" width="5" height="4.6" rx="1.4" fill="#C4566A" />
      </g>
    </svg>
  );
}

/** 우리 가족 연락처 — 세 사람 */
export function IconFamily({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="13" cy="19" r="5.2" fill="#9BC7EB" stroke="#3F6E92" strokeWidth="1.5" />
      <path d="M4.5 35c0-4.7 3.8-7.6 8.5-7.6s8.5 2.9 8.5 7.6z" fill="#9BC7EB" stroke="#3F6E92" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="35" cy="19" r="5.2" fill="#F4B6A0" stroke="#9C5C46" strokeWidth="1.5" />
      <path d="M26.5 35c0-4.7 3.8-7.6 8.5-7.6s8.5 2.9 8.5 7.6z" fill="#F4B6A0" stroke="#9C5C46" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="24" cy="16.5" r="6.2" fill="#FFD85E" stroke="#A8455A" strokeWidth="1.5" />
      <path d="M14 37c0-5.6 4.5-9 10-9s10 3.4 10 9z" fill="#FFD85E" stroke="#A8455A" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** 오늘 건강 리포트 — 문서 */
export function IconReport({ size = 40 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="10" y="7" width="28" height="34" rx="4.5" fill="#FFFFFF" stroke="#4472A8" strokeWidth="1.7" />
      <rect x="10" y="7" width="6" height="34" rx="4.5" fill="#BBD6F2" />
      <g stroke="#4472A8" strokeWidth="2.2" strokeLinecap="round">
        <path d="M21 16h11" />
        <path d="M21 23h11" />
        <path d="M21 30h7" />
      </g>
    </svg>
  );
}

/* ── 탭바 아이콘 — 라인 스타일. 활성일 때만 채운다 ─────────── */

type TabIconProps = { active?: boolean };

const tab = (active: boolean) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: active ? 2.2 : 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: "false" as const,
});

export function TabHome({ active }: TabIconProps) {
  return (
    <svg {...tab(!!active)}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.8V20h13V9.8" fill={active ? "currentColor" : "none"} />
      {!active && <path d="M10 20v-5h4v5" />}
    </svg>
  );
}

export function TabReport({ active }: TabIconProps) {
  return (
    <svg {...tab(!!active)}>
      <path d="M6 3.5h8l4 4V20.5H6z" fill={active ? "currentColor" : "none"} />
      {!active && (
        <>
          <path d="M14 3.5v4h4" />
          <path d="M9 12h6M9 16h4" />
        </>
      )}
    </svg>
  );
}

export function TabBell({ active }: TabIconProps) {
  return (
    <svg {...tab(!!active)}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" fill={active ? "currentColor" : "none"} />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function TabChat({ active }: TabIconProps) {
  return (
    <svg {...tab(!!active)}>
      <path
        d="M4 11.5c0-4 3.6-7 8-7s8 3 8 7-3.6 7-8 7c-1 0-2-.15-2.9-.42L5.5 20l.8-3.1C4.85 15.5 4 13.6 4 11.5Z"
        fill={active ? "currentColor" : "none"}
      />
    </svg>
  );
}

export function TabSettings({ active }: TabIconProps) {
  return (
    <svg {...tab(!!active)}>
      <circle cx="12" cy="12" r="3.2" fill={active ? "currentColor" : "none"} />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
    </svg>
  );
}

export function TabMore({ active }: TabIconProps) {
  return (
    <svg {...tab(!!active)}>
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── 인사 영역 아바타 ────────────────────────────────────────
   시안의 캐릭터 초상을 대신하는 자리표시자. 일러스트를 받으면 <img> 로 교체한다. */

export function AvatarSenior({ size = 64 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="32" fill="#E7DFF6" />
      <circle cx="32" cy="27" r="13" fill="#F6D9C8" />
      <path d="M19 26a13 13 0 0 1 26 0c0-2-3-9-13-9s-13 7-13 9Z" fill="#D8D8DE" />
      <circle cx="27" cy="27" r="1.8" fill="#4A3A30" />
      <circle cx="37" cy="27" r="1.8" fill="#4A3A30" />
      <path d="M28 33c1.4 1.6 2.6 2.3 4 2.3s2.6-.7 4-2.3" stroke="#4A3A30" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M12 64c0-11 9-18 20-18s20 7 20 18z" fill="#B9A6E0" />
    </svg>
  );
}

export function AvatarGuardian({ size = 64 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="32" fill="#FDEBC9" />
      <path d="M18 30c0-9 6-15 14-15s14 6 14 15v3H18z" fill="#6B4A34" />
      <circle cx="32" cy="30" r="12" fill="#F8DDC6" />
      <circle cx="27.5" cy="29" r="1.8" fill="#3F2E22" />
      <circle cx="36.5" cy="29" r="1.8" fill="#3F2E22" />
      <path d="M28.5 35c1.2 1.4 2.3 2 3.5 2s2.3-.6 3.5-2" stroke="#3F2E22" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M12 64c0-11 9-18 20-18s20 7 20 18z" fill="#F2C94C" />
    </svg>
  );
}
