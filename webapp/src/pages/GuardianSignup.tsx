/** 자녀 회원가입 — 이메일 + 비밀번호.
 *
 *  가입하면 가족이 자동으로 만들어진다. 부모님은 가입 후 별도로 등록한다
 *  (자녀 1 : 부모 N).
 *
 *  이메일과 동의는 나중에 붙이면 전원에게 다시 받아야 하므로 지금 받는다(계획서 12.1).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { phoneAsYouType } from "../shared/format";
import { Glyph } from "../shared/glyphs";
import { PolicySheet } from "../shared/policy";
import { afterLogin } from "../native/bridge";
import { saveTokens } from "../shared/auth";
import type { TokenPair } from "../shared/types";
import { BigButton, Check, Field, Notice } from "../shared/ui";

const PHONE_PATTERN = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;
const MIN_PASSWORD = 8;

export default function GuardianSignup() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [agreeHealth, setAgreeHealth] = useState(false);
  // 리포트 메일 동의는 뺐다 (2026-09-11). 동의는 받는데 보내는 코드가 없어
  // 지키지 못할 약속이었다. 기능이 생기면 그때 다시 받는다.

  // 방침은 덮개로 연다. 라우터로 옮기면 이 화면이 사라져 입력하던 내용이 전부 날아간다
  const [policyOpen, setPolicyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const passwordShort = password.length > 0 && password.length < MIN_PASSWORD;
  const passwordMismatch = password2.length > 0 && password !== password2;

  const canSubmit =
    email.trim().length > 3 &&
    password.length >= MIN_PASSWORD &&
    password === password2 &&
    name.trim().length > 0 &&
    PHONE_PATTERN.test(phone.trim()) &&
    agreeHealth &&
    !busy;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const tokens = await request<TokenPair>("/auth/register", {
        method: "POST",
        body: {
          email: email.trim(),
          password,
          name: name.trim(),
          phone: phone.trim(),
          agree_health_data: agreeHealth,
        },
      });
      await saveTokens(tokens.access_token, tokens.refresh_token);
      void afterLogin("guardian");
      // 가입 직후에는 부모님이 없다. 바로 등록 화면으로 보낸다.
      nav("/g/seniors/new", { replace: true, state: { first: true } });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={() => nav("/login")} aria-label="뒤로 가기"><Glyph name="back" size={26} /></button>
        <h1>회원가입</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        <section className="form-card">
          <h2>
            <span className="tagcolor me" aria-hidden="true" />
            로그인 정보
          </h2>
          <Field
            label="이메일"
            value={email}
            onChange={setEmail}
            placeholder="minsu@example.com"
            type="email"
            inputMode="email"
            hint="로그인할 때 쓰고, 부모님 리포트도 이 주소로 보내드립니다."
            autoFocus
          />
          <Field
            label="비밀번호"
            value={password}
            onChange={setPassword}
            placeholder="8자 이상"
            type="password"
            hint={passwordShort ? "8자 이상으로 만들어 주세요." : undefined}
          />
          <Field
            label="비밀번호 확인"
            value={password2}
            onChange={setPassword2}
            placeholder="한 번 더 입력"
            type="password"
            hint={passwordMismatch ? "비밀번호가 서로 다릅니다." : undefined}
          />
        </section>

        <section className="form-card">
          <h2>
            <span className="tagcolor senior" aria-hidden="true" />내 정보
          </h2>
          <Field label="이름" value={name} onChange={setName} placeholder="김민수" />
          <Field
            label="연락처"
            value={phone}
            onChange={(v) => setPhone(phoneAsYouType(v))}
            placeholder="010-1234-5678"
            inputMode="tel"
            hint="부모님이 이 이름과 번호로 앱에 들어오십니다."
          />
        </section>

        <section className="form-card">
          <h2>
            <span className="tagcolor agree" aria-hidden="true" />
            동의
          </h2>
          <Check
            label="부모님의 건강 정보를 확인하고 가족과 공유하는 데 동의합니다."
            checked={agreeHealth}
            onChange={setAgreeHealth}
            required
          />
          {/* 동의의 대상 문서를 읽을 수 있어야 한다. 앱 번들 안에 있는데 여는 길이 없었다
              (2026-09-11 점검). 앱에서도 열리도록 절대 주소를 쓴다. */}
          <p className="field-hint" style={{ marginTop: 10 }}>
            <button className="text-link inline" onClick={() => setPolicyOpen(true)}>
              개인정보처리방침
            </button>
            <span className="muted"> 을 읽고 동의합니다.</span>
          </p>
        </section>

        <Notice tone="error">{error}</Notice>
      </main>

      <div className="sticky-cta">
        <BigButton tone="primary" onClick={submit} disabled={!canSubmit}>
          {busy ? "만드는 중…" : "가입하기"}
        </BigButton>
      </div>

      <PolicySheet open={policyOpen} onClose={() => setPolicyOpen(false)} />
    </div>
  );
}
