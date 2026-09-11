/** 개인정보처리방침 본문 — 화면으로도, 덮개로도 쓴다 (2026-09-11).
 *
 *  문서는 `webapp/public/privacy.html` 하나뿐이다. 웹·스토어가 같은 파일을 보고,
 *  여기서는 그 파일의 <main> 만 꺼내 앱 톤으로 그린다. 내용이 두 벌이 되지 않게.
 *
 *  가입 화면에서는 **이동하지 않고 덮는다.** 라우터로 옮기면 가입 화면이 사라져
 *  입력하던 내용이 전부 날아간다 — 실제로 그런 신고가 있었다.
 */

import { useEffect, useState } from "react";

import { docUrl } from "./base";
import { Glyph } from "./glyphs";
import { useOverlayBack } from "./overlay";
import { BigButton, Notice, Spinner } from "./ui";

/** 방침 본문을 가져온다. (본문 HTML, 오류, 다시 시도) */
export function usePolicyHtml(enabled = true) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setError("");
    fetch(docUrl("privacy.html"))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((text) => {
        if (!alive) return;
        // 우리가 번들에 넣은 파일이다. 바깥에서 온 내용이 아니므로 그대로 그린다.
        const body = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
        setHtml(body ? body[1] : text);
      })
      .catch(() => {
        if (!alive) return;
        setError("문서를 불러오지 못했습니다.");
      });
    return () => {
      alive = false;
    };
  }, [enabled, attempt]);

  return { html, error, retry: () => setAttempt((n) => n + 1) };
}

/** 본문만 그린다. 화면과 덮개가 함께 쓴다. */
export function PolicyBody() {
  const { html, error, retry } = usePolicyHtml();

  return (
    <>
      <Notice tone="error">{error}</Notice>
      {!html && !error && <Spinner />}
      {error && (
        <BigButton tone="primary" onClick={retry}>
          다시 시도
        </BigButton>
      )}
      {html && <article className="policy-doc" dangerouslySetInnerHTML={{ __html: html }} />}
    </>
  );
}

/** 지금 화면 위에 덮어 보여 준다. 뒤의 화면은 그대로 살아 있다. */
export function PolicySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  /* 안드로이드 뒤로가기가 시트만 닫게 한다. 이게 없으면 가입 화면을 떠나
     입력한 것이 날아간다 — 라우터로 옮기지 않은 이유가 그것이다 (2026-09-11) */
  useOverlayBack(open, onClose);

  // 덮개가 열린 동안 뒤가 스크롤되면 어디를 보고 있는지 잃는다
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="policy-sheet" role="dialog" aria-modal="true" aria-label="개인정보처리방침">
      <header className="policy-sheet-head">
        <span className="icon-btn-space" />
        <h2>개인정보처리방침</h2>
        <button className="icon-btn" onClick={onClose} aria-label="닫기">
          <Glyph name="close" size={26} />
        </button>
      </header>
      <div className="policy-sheet-body">
        <PolicyBody />
      </div>
    </div>
  );
}
