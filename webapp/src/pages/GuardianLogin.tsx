/** 자녀 로그인 — 이메일 + 비밀번호.
 *
 *  토큰을 잃어도 다시 들어올 수 있어야 한다. 예전에는 등록 화면밖에 없어서
 *  이미 가족이 있는 계정은 막혔다.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { afterLogin } from "../native/bridge";
import { saveTokens } from "../shared/auth";
import { Art } from "../shared/art";
import { Glyph } from "../shared/glyphs";
import type { TokenPair } from "../shared/types";
import { BigButton, Field, Notice } from "../shared/ui";

export default function GuardianLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const tokens = await request<TokenPair>("/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      await saveTokens(tokens.access_token, tokens.refresh_token);
      void afterLogin("guardian");
      nav("/g/home", { replace: true });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
      );
      setBusy(false);
    }
  }

  const canSubmit = email.trim().length > 3 && password.length > 0 && !busy;

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={() => nav("/")} aria-label="뒤로 가기">
          <Glyph name="back" size={26} />
        </button>
        <h1>로그인</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        <div className="brand-inline">
          <Art name="logo" />
          <span className="brand-name">허브패밀리</span>
        </div>

        {/* "다시 오셨네요" 는 뺐다 (2026-09-11). 읽을 거리 없이 바로 입력으로 간다.
            빠진 자리만큼 로고와 입력칸 사이를 띄운다. */}
        <div className="login-gap" aria-hidden="true" />

        <section className="form-card bare">
          <Field
            label="이메일"
            value={email}
            onChange={setEmail}
            placeholder="minsu@example.com"
            type="email"
            inputMode="email"
            icon="mail"
            autoFocus
          />
          <Field
            label="비밀번호"
            value={password}
            onChange={setPassword}
            placeholder="비밀번호"
            type="password"
            icon="lock"
          />
        </section>

        <Notice tone="error">{error}</Notice>

        <button className="text-link" onClick={() => nav("/forgot")}>
          비밀번호를 잊으셨나요?
        </button>

        <button className="text-link" onClick={() => nav("/signup")}>
          <span className="muted">아직 계정이 없으신가요? </span>회원가입
        </button>
      </main>

      <div className="sticky-cta">
        <BigButton tone="primary" onClick={submit} disabled={!canSubmit}>
          {busy ? "확인하는 중…" : "로그인"}
        </BigButton>
      </div>
    </div>
  );
}
