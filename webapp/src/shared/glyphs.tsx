/** 선 아이콘 — 리디자인 시안의 얇은 파란 선 아이콘.
 *
 *  currentColor 를 쓰므로 글자색을 따라간다. 크기는 1em 기준.
 *  장식이다 — aria-hidden. 의미는 옆 글자가 전달한다 (계획서 9장).
 */

import type { CSSProperties } from "react";

const PATHS: Record<string, string> = {
  home: "M4 10.5 12 4l8 6.5V20H4z M9.5 20v-6h5v6",
  report: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M9 8h6 M9 12h6 M9 16h4",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5 M8 14h.01 M12 14h.01 M16 14h.01",
  grid: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  message: "M4 5h16v11H9l-5 4z M8 10h8",
  back: "M14.5 5 8 12l6.5 7",
  chevron: "m9.5 5 6.5 7-6.5 7",
  plus: "M12 5v14 M5 12h14",
  close: "M6 6l12 12 M18 6 6 18",
  gear: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z M10 20a2 2 0 0 0 4 0",
  pencil: "M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z M13 7l4 4",
  camera: "M4 8h3l2-3h6l2 3h3v11H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  mail: "M3 6h18v12H3z M3 7l9 6 9-6",
  lock: "M6 11h12v10H6z M9 11V8a3 3 0 0 1 6 0v3 M12 15v2",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
  users: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M3 20a6 6 0 0 1 12 0 M16 4.5a3.5 3.5 0 0 1 0 7 M21 20a6 6 0 0 0-4.5-5.8",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  pin: "M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5",
  logout: "M10 4H5v16h5 M14 8l5 4-5 4 M19 12H9",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4 12H2 M22 12h-2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  check: "m5 12 5 5 9-10",
  warning: "M12 3 2 20h20z M12 9v5 M12 17h.01",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  photoPlus: "M4 6h16v13H4z M8 15l3-3 2.5 2.5L16 12l3 4 M17 3v4 M15 5h4",
};

export type GlyphName = keyof typeof PATHS;

export function Glyph({
  name,
  size = 22,
  stroke = 1.8,
  className,
  style,
}: {
  name: GlyphName;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`glyph${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
