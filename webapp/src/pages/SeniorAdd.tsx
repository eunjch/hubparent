/** 부모님 등록 · 수정 — 자녀가 부모님 계정을 만들고 고친다.
 *
 *  어르신은 아무것도 입력하지 않는다. 성함과 연락처를 자녀가 넣어주면,
 *  어르신은 자녀 이름·번호로 들어와 목록에서 본인을 고르기만 한다 (계획서 1.4).
 *
 *  /g/seniors/new  → 등록. 가입 직후에는 first 상태로 "먼저 부모님을 등록해 주세요".
 *  /g/seniors/:id  → 수정. 목록에서 값을 채워 온다.
 */

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { prettyPhone } from "../shared/format";
import { Art } from "../shared/art";
import type { Senior } from "../shared/types";
import { BigButton, Field, Notice, Spinner } from "../shared/ui";

const PHONE_PATTERN = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;
const YEAR_PATTERN = /^(19|20)\d{2}$/;

export default function SeniorAdd() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const first = (useLocation().state as { first?: boolean } | null)?.first === true;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [loaded, setLoaded] = useState(!editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    request<Senior[]>("/family/seniors")
      .then((rows) => {
        const s = rows.find((r) => r.id === id);
        if (!s) {
          setError("부모님을 찾을 수 없습니다.");
          return;
        }
        setName(s.name);
        setPhone(prettyPhone(s.phone));
        setRelation(s.relation ?? "");
        setBirthYear(s.birth_year ? String(s.birth_year) : "");
        setLoaded(true);
      })
      .catch(() => setError("정보를 불러오지 못했습니다."));
  }, [id]);

  const yearOk = birthYear.trim() === "" || YEAR_PATTERN.test(birthYear.trim());
  const canSubmit = name.trim().length > 0 && PHONE_PATTERN.test(phone.trim()) && yearOk && !busy;

  async function submit() {
    setBusy(true);
    setError("");
    const body = {
      name: name.trim(),
      phone: phone.trim(),
      relation: relation.trim() || null,
      birth_year: birthYear.trim() ? Number(birthYear.trim()) : null,
    };
    try {
      if (editing) {
        await request<Senior>(`/family/seniors/${id}`, { method: "PATCH", body });
      } else {
        await request<Senior>("/family/seniors", { method: "POST", body });
      }
      nav("/g/seniors", { replace: true });
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
        <button
          className="icon-btn"
          onClick={() => nav(first ? "/g/home" : "/g/seniors", { replace: true })}
          aria-label="뒤로 가기"
        >
          ‹
        </button>
        <h1>{editing ? "부모님 정보 수정" : "부모님 등록"}</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        {!editing && (
          <div className="hero" style={{ paddingBottom: "var(--gap-tight)" }}>
            <span className="hero-badge">
              <Art name="tileHeart" />
            </span>
            <h2>
              {first ? "먼저 부모님을 등록해 주세요" : "부모님을 추가합니다"}
            </h2>
            <p>부모님은 따로 가입하지 않으셔도 됩니다.</p>
          </div>
        )}

        {!loaded && !error && <Spinner />}

        {loaded && (
          <section className="form-card">
            <Field label="성함" value={name} onChange={setName} placeholder="김영희" autoFocus={!editing} />
            <Field
              label="연락처"
              value={phone}
              onChange={setPhone}
              placeholder="010-8765-4321"
              inputMode="tel"
            />
            <Field label="관계" value={relation} onChange={setRelation} placeholder="어머니" />
            <Field
              label="출생연도"
              labelNote="(선택)"
              value={birthYear}
              onChange={setBirthYear}
              placeholder="1950"
              inputMode="numeric"
            />
            {editing && (
              <p className="field-hint">
                번호를 바꾸면 부모님은 새 번호의 휴대폰에서 자녀 이름·번호로 다시 들어오시면 됩니다.
              </p>
            )}
          </section>
        )}

        <Notice tone="error">{error}</Notice>
      </main>

      <div className="sticky-cta">
        <BigButton tone="primary" onClick={submit} disabled={!canSubmit}>
          {busy ? "저장하는 중…" : editing ? "저장하기" : "등록하기"}
        </BigButton>
      </div>
    </div>
  );
}
