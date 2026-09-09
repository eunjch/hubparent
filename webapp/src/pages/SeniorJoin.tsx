/** 부모 로그인 — 자녀 이름 + 자녀 번호 → 본인 선택.
 *
 *  어르신에게 비밀번호를 만들게 하지 않는다. 자녀 이름과 번호는 대개 외우고
 *  있거나 전화기에 있는 정보다 (계획서 1.4).
 *
 *  용어 규칙(계획서 9장): "인증", "계정" 같은 말은 쓰지 않는다.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { afterLogin } from "../native/bridge";
import { saveTokens } from "../shared/auth";
import { Art } from "../shared/art";
import { Glyph } from "../shared/glyphs";
import type { SeniorLookupResult, TokenPair } from "../shared/types";
import { BigButton, Field, Notice, Spinner } from "../shared/ui";

export default function SeniorJoin() {
  const nav = useNavigate();
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [found, setFound] = useState<SeniorLookupResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canLookup = guardianName.trim().length > 0 && guardianPhone.trim().length >= 10 && !busy;

  async function lookup() {
    setBusy(true);
    setError("");
    try {
      const result = await request<SeniorLookupResult>("/auth/senior/lookup", {
        method: "POST",
        body: { guardian_name: guardianName.trim(), guardian_phone: guardianPhone.trim() },
      });
      setFound(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "이름과 번호를 다시 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(seniorId: string) {
    setBusy(true);
    setError("");
    try {
      const tokens = await request<TokenPair>("/auth/senior/login", {
        method: "POST",
        body: {
          guardian_name: guardianName.trim(),
          guardian_phone: guardianPhone.trim(),
          senior_id: seniorId,
        },
      });
      await saveTokens(tokens.access_token, tokens.refresh_token);
      // 자녀가 옆에서 도와주는 이 시점이 권한을 받기 가장 좋은 때다 (계획서 8.5.4)
      void afterLogin("senior");
      nav("/s/home", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  /* ── 2단계 — 본인 선택 ── */
  if (found) {
    return (
      <div className="screen">
        <header className="screen-head">
          <button className="icon-btn" onClick={() => setFound(null)} aria-label="뒤로 가기">
            <Glyph name="back" size={26} />
          </button>
          <h1>확인</h1>
          <span className="icon-btn-space" />
        </header>

        <main className="screen-body">
          <p className="sub" style={{ textAlign: "center" }}>
            <b>{found.guardian_name}</b> 님의 가족입니다.
            <br />
            어느 분이신가요?
          </p>

          <div className="choice-list">
            {found.seniors.map((s) => (
              <button
                key={s.id}
                className="choice-card"
                onClick={() => choose(s.id)}
                disabled={busy}
              >
                <span className="face">
                  <Art name="avatarGrandma" size={52} />
                </span>
                <span className="body">
                  <span className="t">{s.name}</span>
                  {s.relation && <span className="d">{s.relation}</span>}
                </span>
                <span className="chev" aria-hidden="true"><Glyph name="chevron" size={20} /></span>
              </button>
            ))}
          </div>

          <Notice tone="error">{error}</Notice>
          {busy && <Spinner label="들어가는 중…" />}
        </main>
      </div>
    );
  }

  /* ── 1단계 — 자녀 정보 입력 ── */
  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={() => nav("/")} aria-label="뒤로 가기">
          <Glyph name="back" size={26} />
        </button>
        <h1>시작하기</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        <div className="hero" style={{ padding: "12px 0 4px" }}>
          <span className="hero-badge">
            <Art name="tileHeart" />
          </span>
          <h2>
            자녀분의 이름과
            <br />
            전화번호를 넣어주세요
          </h2>
        </div>

        <section className="form-card">
          <Field
            label="자녀 이름"
            value={guardianName}
            onChange={setGuardianName}
            placeholder="김민수"
            icon="user"
            autoFocus
          />
          <Field
            label="자녀 전화번호"
            value={guardianPhone}
            onChange={setGuardianPhone}
            placeholder="010-1234-5678"
            inputMode="tel"
            icon="phone"
          />
        </section>

        <Notice tone="error">{error}</Notice>
        {busy && <Spinner label="찾는 중…" />}
      </main>

      <div className="sticky-cta">
        <BigButton tone="primary" onClick={lookup} disabled={!canLookup}>
          다음
        </BigButton>
      </div>
    </div>
  );
}
