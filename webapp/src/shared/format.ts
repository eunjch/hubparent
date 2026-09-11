/** 표시용 서식. 서버는 숫자만 저장한다 (01012345678) — 화면에서만 붙임표를 넣는다. */

/** 01012345678 → 010-1234-5678 */
export function prettyPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p;
}

/** 입력 중에도 붙임표를 붙인다 (2026-09-11).
 *
 *  `prettyPhone` 은 다 적은 번호를 보여 줄 때 쓰고, 이건 한 글자씩 칠 때 쓴다.
 *  덜 적은 상태에서도 모양이 잡혀야 부모님이 지금 어디까지 넣었는지 안다.
 *
 *    010      → 010
 *    0101234  → 010-1234
 *    01012345678 → 010-1234-5678
 *
 *  숫자가 아닌 것은 버린다. 11자리를 넘겨 치면 그 뒤는 무시한다 — 잘못 눌러도
 *  칸이 이상해지지 않는다. 02 같은 지역번호는 이 앱에서 안 쓰므로 다루지 않는다.
 */
export function phoneAsYouType(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
