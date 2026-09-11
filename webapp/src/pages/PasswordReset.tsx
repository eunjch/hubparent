/** 화면 — 비밀번호 찾기 / 새로 정하기 (2026-09-11 점검에서 추가).
 *
 *  자녀 계정이 이 서비스의 유일한 뿌리다. 부모님은 자녀 이름·전화번호로 들어오므로,
 *  자녀가 비밀번호를 잊으면 **자녀도 부모님도 들어갈 방법이 없었다.**
 *
 *  한 화면이 두 단계를 겸한다. 주소에 토큰이 있으면 새 비밀번호를 정하는 단계,
 *  없으면 메일을 요청하는 단계다. 메일 속 링크가 /reset?token=... 으로 들어온다.
 */

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { Art } from "../shared/art";
import { BigButton, Field, Notice, Screen } from "../shared/ui";

export default function PasswordReset() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function sendMail() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await request("/auth/password/forgot", { method: "POST", body: { email: email.trim() } });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (busy) return;
    if (password !== again) {
      setError("두 번 입력한 비밀번호가 서로 다릅니다.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await request("/auth/password/reset", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  /* ── 새 비밀번호를 정하는 단계 ─────────────────────────────── */
  if (token) {
    if (done) {
      return (
        <Screen title="비밀번호 변경" onBack={() => nav("/login")}>
          <div className="hero" style={{ padding: "8px 0 4px" }}>
            <span className="hero-badge">
              <Art name="tilePerson" />
            </span>
            <h2>새 비밀번호로 바꿨어요</h2>
          </div>
          <p className="field-hint">이제 새 비밀번호로 로그인하실 수 있습니다.</p>
          <BigButton tone="primary" onClick={() => nav("/login", { replace: true })}>
            로그인하러 가기
          </BigButton>
        </Screen>
      );
    }

    return (
      <Screen
        title="비밀번호 변경"
        onBack={() => nav("/login")}
        footer={
          <BigButton
            tone="primary"
            onClick={savePassword}
            disabled={busy || password.length < 8 || again.length < 8}
          >
            {busy ? "바꾸는 중…" : "새 비밀번호로 바꾸기"}
          </BigButton>
        }
      >
        <p className="field-hint">새로 쓰실 비밀번호를 두 번 입력해 주세요.</p>
        <section className="form-card bare">
          <Field
            label="새 비밀번호"
            value={password}
            onChange={setPassword}
            placeholder="8자 이상"
            type="password"
            icon="lock"
            autoFocus
          />
          <Field
            label="비밀번호 확인"
            value={again}
            onChange={setAgain}
            placeholder="한 번 더 입력"
            type="password"
            icon="lock"
          />
        </section>
        <Notice tone="error">{error}</Notice>
      </Screen>
    );
  }

  /* ── 메일을 요청하는 단계 ──────────────────────────────────── */
  if (done) {
    return (
      <Screen title="비밀번호 찾기" onBack={() => nav("/login")}>
        <div className="hero" style={{ padding: "8px 0 4px" }}>
          <span className="hero-badge">
            <Art name="clipboard" />
          </span>
          <h2>메일을 보냈어요</h2>
        </div>
        {/* 가입 여부를 알려주지 않는다 — 서버도 같은 답을 준다 */}
        <p className="field-hint">
          가입된 주소라면 비밀번호를 새로 정하는 링크가 도착합니다. 30분 안에 열어 주세요.
          <br />
          메일이 안 보이면 스팸함도 확인해 보세요.
        </p>
        <BigButton onClick={() => nav("/login", { replace: true })}>로그인으로 돌아가기</BigButton>
      </Screen>
    );
  }

  return (
    <Screen
      title="비밀번호 찾기"
      onBack={() => nav("/login")}
      footer={
        <BigButton tone="primary" onClick={sendMail} disabled={busy || email.trim().length < 5}>
          {busy ? "보내는 중…" : "재설정 메일 받기"}
        </BigButton>
      }
    >
      <p className="field-hint">가입하실 때 쓴 이메일 주소를 넣어 주세요.</p>
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
      </section>
      <Notice tone="error">{error}</Notice>
    </Screen>
  );
}
