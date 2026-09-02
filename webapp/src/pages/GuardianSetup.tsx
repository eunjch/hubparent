/** G1 자녀 시작 — 계정 · 가족 · 부모님 등록을 한 화면에서 끝낸다.
 *
 *  계획서 1.4: 본인인증이 없다. 대신 부모님 계정을 자녀가 만들어 주므로
 *  어르신 쪽 입력이 0이 된다.
 *
 *  이메일과 동의는 나중에 붙이면 전원에게 다시 받아야 하므로 지금 받는다(계획서 12.1).
 *  입력이 많은 화면이라 세 묶음으로 나눠 어디까지 했는지 보이게 한다.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { saveTokens } from "../shared/auth";
import { Scene } from "../shared/Scene";
import type { FamilyCreated, TokenPair } from "../shared/types";
import { BigButton, Check, Field, Notice } from "../shared/ui";

const PHONE_PATTERN = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;

export default function GuardianSetup() {
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [seniorName, setSeniorName] = useState("");
  const [seniorPhone, setSeniorPhone] = useState("");
  const [relation, setRelation] = useState("");

  const [agreeHealth, setAgreeHealth] = useState(false);
  const [agreeEmail, setAgreeEmail] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filled =
    name.trim() &&
    PHONE_PATTERN.test(phone.trim()) &&
    seniorName.trim() &&
    PHONE_PATTERN.test(seniorPhone.trim());
  const canSubmit = Boolean(filled) && agreeHealth && !busy;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const tokens = await request<TokenPair>("/auth/start", {
        method: "POST",
        body: {
          phone: phone.replace(/-/g, "").trim(),
          name: name.trim(),
          role: "guardian",
          email: email.trim() || null,
          agree_health_data: agreeHealth,
          agree_email_report: agreeEmail,
        },
      });
      await saveTokens(tokens.access_token, tokens.refresh_token);

      const created = await request<FamilyCreated>("/families", {
        method: "POST",
        body: {
          name: `${seniorName.trim()} 가족`,
          senior_name: seniorName.trim(),
          senior_phone: seniorPhone.replace(/-/g, "").trim(),
          relation: relation.trim() || null,
        },
      });

      nav("/setup/code", { state: created, replace: true });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="screen onboard">
      <Scene />

      <header className="screen-head">
        <button className="icon-btn" onClick={() => nav("/")} aria-label="뒤로 가기">
          ‹
        </button>
        <h1>부모님 등록</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        <p className="sub" style={{ textAlign: "center", marginBottom: 4 }}>
          입력을 마치면 부모님께 알려드릴
          <br />
          여섯 자리 번호가 만들어집니다.
        </p>

        <section className="form-card">
          <h2>
            <span className="tagcolor me" aria-hidden="true" />내 정보
          </h2>
          <Field label="이름" value={name} onChange={setName} placeholder="김민수" autoFocus />
          <Field
            label="연락처"
            value={phone}
            onChange={setPhone}
            placeholder="010-1234-5678"
            inputMode="tel"
          />
          <Field
            label="이메일"
            value={email}
            onChange={setEmail}
            placeholder="minsu@example.com"
            type="email"
            inputMode="email"
            hint="부모님의 하루 리포트를 메일로 보내드립니다."
          />
        </section>

        <section className="form-card">
          <h2>
            <span className="tagcolor senior" aria-hidden="true" />
            부모님 정보
          </h2>
          <Field label="성함" value={seniorName} onChange={setSeniorName} placeholder="김영희" />
          <Field
            label="연락처"
            value={seniorPhone}
            onChange={setSeniorPhone}
            placeholder="010-8765-4321"
            inputMode="tel"
          />
          <Field label="관계" value={relation} onChange={setRelation} placeholder="어머니" />
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
          <Check
            label="하루 리포트를 이메일로 받겠습니다."
            checked={agreeEmail}
            onChange={setAgreeEmail}
          />
        </section>

        <Notice tone="error">{error}</Notice>
      </main>

      <div className="sticky-cta">
        <BigButton tone="primary" onClick={submit} disabled={!canSubmit}>
          {busy ? "만드는 중…" : "부모님 등록하기"}
        </BigButton>
      </div>
    </div>
  );
}
