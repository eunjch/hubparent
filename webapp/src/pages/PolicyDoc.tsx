/** 화면 — 개인정보처리방침 (2026-09-11 재점검에서 추가).
 *
 *  왜 `<a target="_blank">` 가 아니라 앱 안 화면인가:
 *   - iOS 는 새 창 요청을 시스템에 넘기는데, 앱 오리진이 `capacitor://localhost` 라
 *     받아 줄 앱이 없어 **아무 일도 일어나지 않는다.**
 *   - 안드로이드는 같은 웹뷰에서 이동해 **SPA 가 통째로 사라진다.** 부모님에게는
 *     앱이 없어진 것처럼 보이고, 돌아올 길이 하드웨어 뒤로가기뿐이다.
 *
 *  문서는 `webapp/public/privacy.html` 하나만 둔다 — 웹·스토어가 같은 파일을 쓴다.
 *  여기서는 그 파일의 <main> 만 꺼내 보여 준다. 내용이 두 벌이 되지 않게.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { docUrl } from "../shared/base";
import { BigButton, Notice, Screen, Spinner } from "../shared/ui";

export default function PolicyDoc() {
  const nav = useNavigate();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
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
  }, [attempt]);

  return (
    <Screen title="개인정보처리방침" onBack={() => nav(-1)}>
      <Notice tone="error">{error}</Notice>
      {!html && !error && <Spinner />}
      {error && (
        <BigButton tone="primary" onClick={() => setAttempt((n) => n + 1)}>
          다시 시도
        </BigButton>
      )}
      {html && (
        <article className="policy-doc" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </Screen>
  );
}
