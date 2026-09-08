/** 화면 G4 — 약 복용 시간 설정 (자녀).
 *
 *  계획서 7.3: 약 복용 시간은 자녀가 설정한다. 어르신은 "복용함 / 안 먹었어요" 만 누른다.
 *  그래서 등록·수정·삭제가 전부 여기 있다.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { Icon } from "../shared/icons";
import type { Medication, Senior } from "../shared/types";
import { BigButton, Field, Notice, Screen, Spinner } from "../shared/ui";

/** 흔히 쓰는 시각을 먼저 준다. 자녀가 직접 칠 수도 있다. */
const PRESET_TIMES = ["08:00", "12:00", "18:00", "20:00", "22:00"];
const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

export default function MedManage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [seniorId, setSeniorId] = useState<string | null>(params.get("user_id"));
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [error, setError] = useState("");

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [customTime, setCustomTime] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    request<Senior[]>("/family/seniors")
      .then((rows) => {
        setSeniors(rows);
        if (!seniorId && rows.length > 0) setSeniorId(rows[0].id);
      })
      .catch(() => setError("부모님 정보를 불러오지 못했습니다."));
    // seniorId 는 최초 1회만 정한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!seniorId) return;
    try {
      setMeds(await request<Medication[]>(`/medications?user_id=${seniorId}`));
    } catch {
      setError("약 목록을 불러오지 못했습니다.");
    }
  }, [seniorId]);

  useEffect(() => {
    setMeds(null);
    void load();
    if (seniorId) setParams({ user_id: seniorId }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seniorId]);

  function toggleTime(t: string) {
    setTimes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()));
  }

  function addCustomTime() {
    const t = customTime.trim();
    if (!TIME_PATTERN.test(t)) {
      setError("시각은 08:00 처럼 입력해 주세요.");
      return;
    }
    const [hh, mm] = t.split(":");
    const norm = `${hh.padStart(2, "0")}:${mm}`;
    setTimes((prev) => (prev.includes(norm) ? prev : [...prev, norm].sort()));
    setCustomTime("");
    setError("");
  }

  function resetForm() {
    setName("");
    setDose("");
    setTimes([]);
    setCustomTime("");
    setAdding(false);
  }

  async function save() {
    if (!seniorId) return;
    setBusy(true);
    setError("");
    try {
      await request<Medication>("/medications", {
        method: "POST",
        body: { user_id: seniorId, name: name.trim(), dose: dose.trim() || null, times },
      });
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(med: Medication) {
    if (!window.confirm(`${med.name}을(를) 목록에서 내릴까요?\n지난 복용 기록은 그대로 남습니다.`))
      return;
    try {
      await request(`/medications/${med.id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
    }
  }

  const current = seniors.find((s) => s.id === seniorId);
  const canSave = name.trim().length > 0 && times.length > 0 && !busy;

  return (
    <Screen title="약 복용 시간" onBack={() => nav("/g/home")}>
      {seniors.length > 1 && (
        <div className="senior-tabs">
          {seniors.map((s) => (
            <button
              key={s.id}
              className="senior-chip"
              aria-pressed={s.id === seniorId}
              onClick={() => setSeniorId(s.id)}
            >
              {s.name}
              {s.relation ? ` (${s.relation})` : ""}
            </button>
          ))}
        </div>
      )}

      {current && (
        <Notice>
          <b>{current.name}</b> {current.relation ?? "님"}의 약입니다. 등록하면 그 시간에 부모님
          휴대폰에서 알림이 울립니다.
        </Notice>
      )}

      <Notice tone="error">{error}</Notice>
      {!meds && seniorId && <Spinner />}
      {seniors.length === 0 && <Notice>먼저 부모님을 등록해 주세요.</Notice>}

      {meds?.length === 0 && <Notice>아직 등록된 약이 없습니다.</Notice>}

      {meds?.map((m) => (
        <div className="med-row" key={m.id}>
          <Icon name="pill" className="lead" />
          <div className="body">
            <span className="t">
              {m.name}
              {m.dose && <span className="dose">{m.dose}</span>}
            </span>
            <span className="times">
              {m.times.map((t) => (
                <span className="time-chip" key={t}>
                  {t}
                </span>
              ))}
            </span>
          </div>
          <button className="row-del" onClick={() => remove(m)} aria-label={`${m.name} 내리기`}>
            내리기
          </button>
        </div>
      ))}

      {adding ? (
        <section className="form-card">
          <h2>
            <span className="tagcolor me" aria-hidden="true" />약 추가
          </h2>

          <Field label="약 이름" value={name} onChange={setName} placeholder="혈압약" autoFocus />
          <Field label="용량" value={dose} onChange={setDose} placeholder="1정 (선택)" />

          <div className="field">
            <span className="field-label">복용 시각</span>
            <div className="time-picks">
              {PRESET_TIMES.map((t) => (
                <button
                  key={t}
                  className={`time-pick${times.includes(t) ? " on" : ""}`}
                  onClick={() => toggleTime(t)}
                  aria-pressed={times.includes(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {times.filter((t) => !PRESET_TIMES.includes(t)).length > 0 && (
              <div className="time-picks">
                {times
                  .filter((t) => !PRESET_TIMES.includes(t))
                  .map((t) => (
                    <button
                      key={t}
                      className="time-pick on"
                      onClick={() => toggleTime(t)}
                      aria-pressed
                    >
                      {t}
                    </button>
                  ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                className="field-input"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                placeholder="09:30"
                inputMode="numeric"
                aria-label="다른 시각 직접 입력"
                style={{ flex: 1 }}
              />
              <button className="row-del" onClick={addCustomTime} style={{ minHeight: 56 }}>
                추가
              </button>
            </div>
            <span className="field-hint">하루에 여러 번이면 시각을 여러 개 고르세요.</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <BigButton tone="primary" onClick={save} disabled={!canSave}>
              {busy ? "저장하는 중…" : "저장"}
            </BigButton>
            <BigButton onClick={resetForm}>취소</BigButton>
          </div>
        </section>
      ) : (
        seniorId && (
          <BigButton tone="primary" icon="pill" onClick={() => setAdding(true)}>
            약 추가하기
          </BigButton>
        )
      )}
    </Screen>
  );
}
