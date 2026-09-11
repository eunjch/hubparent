/** 앱 글자 크기 — 작게 / 중간 / 크게 (2026-09-11).
 *
 *  원래는 "기기 설정을 따르니 앱에는 두지 않는다"(계획서 9.1)였다. 그런데 부모님이
 *  안드로이드 설정에서 글자 크기를 찾아 바꾸는 일은 거의 없다 — 앱 안에 두는 편이 낫다.
 *
 *  글자와 터치 영역은 전부 rem 이라(tokens.css) html 의 font-size 하나만 바꾸면
 *  본문·버튼·터치 최소 크기가 같이 따라 온다. 여백은 px 라 그대로 있다 — 글자만 커진다.
 *  기기 설정과는 곱해진다. 둘 다 키우면 둘 다 적용된다.
 */

export type TextScale = "sm" | "md" | "lg";

const KEY = "hf.textScale";

export const TEXT_SCALES: TextScale[] = ["sm", "md", "lg"];

export const SCALE_LABEL: Record<TextScale, string> = {
  sm: "작게",
  md: "중간",
  lg: "크게",
};

export function getTextScale(): TextScale {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "sm" || v === "md" || v === "lg") return v;
  } catch {
    // 시크릿 모드 등에서 localStorage 가 던진다. 기본값으로 간다
  }
  return "md";
}

/** 화면에 반영만 한다. 첫 렌더 전에 부르면 글자가 한 번 튀지 않는다. */
export function applyTextScale(v: TextScale): void {
  document.documentElement.dataset.textScale = v;
}

export function setTextScale(v: TextScale): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // 저장은 못 해도 이번 실행에는 적용된다
  }
  applyTextScale(v);
}
