/** 부모님 등록 — 자녀가 부모님 계정을 만든다.
 *
 *  어르신은 아무것도 입력하지 않는다. 성함과 연락처를 자녀가 넣어주면,
 *  어르신은 자녀 이름·번호로 들어와 목록에서 본인을 고르기만 한다 (계획서 1.4).
 *
 *  가입 직후에는 first 상태로 들어와 "먼저 부모님을 등록해 주세요" 를 보여준다.
 */

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { Backdrop, Icon } from "../shared/icons";
import type { Senior } from "../shared/types";
import { BigButton, Field, Notice } from "../shared/ui";

const PHONE_PATTERN = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;

export default function SeniorAdd() {
  const nav = useNavigate();
  const first = (useLocation().state as { first?: boolean } | null)?.first === true;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim().length > 0 && PHONE_PATTERN.test(phone.trim()) && !busy;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await request<Senior>("/family/seniors", {
        method: "POST",
        body: {
          name: name.trim(),
          phone: phone.trim(),
          relation: relation.trim() || null,
        },
      });
      nav("/g/seniors", { replace: true });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="screen decorated">
      <Backdrop variant="leaf" />

      <header className="screen-head">
        <button
          className="icon-btn"
          onClick={() => nav(first ? "/g/home" : "/g/seniors", { replace: true })}
          aria-label="뒤로 가기"
        >
          ‹
        </button>
        <h1>부모님 등록</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        <div className="hero" style={{ paddingBottom: "var(--gap-tight)" }}>
          <span className="hero-badge">
            <Icon name="heart" />
          </span>
          <h2 style={{ fontSize: "var(--text-action)" }}>
            {first ? "먼저 부모님을 등록해 주세요" : "부모님을 추가합니다"}
          </h2>
          <p>부모님은 따로 가입하지 않으셔도 됩니다.</p>
        </div>

        <section className="form-card">
          <Field label="성함" value={name} onChange={setName} placeholder="김영희" autoFocus />
          <Field
            label="연락처"
            value={phone}
            onChange={setPhone}
            placeholder="010-8765-4321"
            inputMode="tel"
          />
          <Field label="관계" value={relation} onChange={setRelation} placeholder="어머니" />
        </section>

        <Notice tone="error">{error}</Notice>
      </main>

      <div className="sticky-cta">
        <BigButton tone="primary" onClick={submit} disabled={!canSubmit}>
          {busy ? "등록하는 중…" : "등록하기"}
        </BigButton>
      </div>
    </div>
  );
}
