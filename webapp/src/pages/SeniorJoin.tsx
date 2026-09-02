/** S1 어르신 합류 — 이 앱에서 어르신이 하는 유일한 입력.
 *
 *  6자리를 넣으면 "김영희 님 맞으세요?" 를 확인하고 끝난다.
 *  이름도 전화번호도 묻지 않는다(계획서 1.4).
 *
 *  용어 규칙(계획서 9장): "초대코드" 대신 "번호", "인증" 같은 말은 쓰지 않는다.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { saveTokens } from "../shared/auth";
import type { InvitationPreview, TokenPair } from "../shared/types";
import { BigButton, Notice, Screen, Spinner } from "../shared/ui";

const CODE_LENGTH = 6;

export default function SeniorJoin() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function check() {
    setBusy(true);
    setError("");
    try {
      const found = await request<InvitationPreview>(`/invitations/${code.toUpperCase()}`);
      if (found.used) throw new ApiError("USED", "이미 사용된 번호입니다.", 409);
      if (found.expired) throw new ApiError("EXPIRED", "기간이 지난 번호입니다. 자녀분께 다시 요청해 주세요.", 409);
      setPreview(found);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "번호를 다시 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    setError("");
    try {
      const tokens = await request<TokenPair>(`/invitations/${code.toUpperCase()}/claim`, {
        method: "POST",
      });
      await saveTokens(tokens.access_token, tokens.refresh_token);
      nav("/s/home", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  /* ── 확인 단계 ── 이름을 크게 보여주고 예/아니오만 묻는다 ── */
  if (preview) {
    return (
      <Screen title="확인" onBack={() => setPreview(null)}>
        <p className="sub">아래 이름이 맞으신가요?</p>
        <p className="confirm-name">{preview.target_name} 님</p>
        <p className="sub" style={{ textAlign: "center" }}>{preview.family_name}</p>

        <Notice tone="error">{error}</Notice>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "var(--gap-tight)" }}>
          <BigButton tone="primary" onClick={join} disabled={busy}>
            {busy ? "연결하는 중…" : "네, 맞아요"}
          </BigButton>
          <BigButton onClick={() => setPreview(null)} disabled={busy}>
            아니에요
          </BigButton>
        </div>
      </Screen>
    );
  }

  /* ── 입력 단계 ── */
  return (
    <Screen title="시작하기" onBack={() => nav("/")}>
      <p className="lede">자녀분이 알려준 번호를 넣어주세요</p>
      <p className="sub">여섯 글자입니다.</p>

      <input
        className="field-input code-input"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, "").slice(0, CODE_LENGTH))}
        placeholder="______"
        autoFocus
        aria-label="자녀분이 알려준 번호"
      />

      <Notice tone="error">{error}</Notice>
      {busy && <Spinner label="확인하는 중…" />}

      <div style={{ marginTop: "auto" }}>
        <BigButton tone="primary" onClick={check} disabled={code.length < CODE_LENGTH || busy}>
          다음
        </BigButton>
      </div>
    </Screen>
  );
}
