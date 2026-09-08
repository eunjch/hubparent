/** 표시용 서식. 서버는 숫자만 저장한다 (01012345678) — 화면에서만 붙임표를 넣는다. */

/** 01012345678 → 010-1234-5678 */
export function prettyPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}
