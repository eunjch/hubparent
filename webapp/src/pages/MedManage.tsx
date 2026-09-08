/** 화면 G4 — 약 복용 관리 (자녀). 시안 "④ 약 복용 시간 설정".
 *
 *  세그먼트 탭 `복용 약 목록 / 복용 설정`.
 *  목록: 시점 · 시각 · 약 이름 + 알림 토글. 설정: 약 추가 폼.
 *  계획서 7.3: 약 복용 시간은 자녀가 설정한다. 어르신은 응답만 한다.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { Backdrop, Icon } from "../shared/icons";
import type { Medication, Senior } from "../shared/types";
import { BigButton, Cheer, Field, Notice, SegTabs, Spinner } from "../shared/ui";

type Tab = "list" | "settings";

/** 흔히 쓰는 시각을 먼저 준다. 자녀가 직접 칠 수도 있다. */
const PRESET_TIMES = ["08:00", "12:00", "18:00", "20:00", "22:00"];
const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** "08:00" → 아침 / 점심 / 저녁 (시안의 시점 라벨) */
function slotOf(time: string): { label: string; icon: "sun" | "moon" } {
  const h = Number(time.split(":")[0]);
  if (h < 11) return { label: "아침", icon: "sun" };
  if (h < 17) return { label: "점심", icon: "sun" };
  return { label: "저녁", icon: "moon" };
}

export default function MedManage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>("list");
  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [seniorId, setSeniorId] = useState<string | null>(params.get("user_id"));
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [error, setError] = useState("");

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
      setTab("list");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  /** 알림 토글. 끄면 오늘 목록에서 빠지고 이력은 남는다. */
  async function toggleActive(med: Medication) {
    setError("");
    // 화면을 먼저 바꾼다
    setMeds((prev) =>
      (prev ?? []).map((m) => (m.id === med.id ? { ...m, is_active: !m.is_active } : m)),
    );
    try {
      if (med.is_active) {
        await request(`/medications/${med.id}`, { method: "DELETE" });
      } else {
        await request(`/medications/${med.id}`, { method: "PATCH", body: { is_active: true } });
      }
      await load();
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
      await load();
    }
  }

  const current = seniors.find((s) => s.id === seniorId);
  const canSave = name.trim().length > 0 && times.length > 0 && !busy;

  // 시안은 약 하나가 아니라 "시점·시각" 한 건이 한 행이다
  const rows = (meds ?? []).flatMap((m) =>
    m.times.map((t) => ({ med: m, time: t, ...slotOf(t) })),
  );
  rows.sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="screen decorated">
      <Backdrop />

      <header className="screen-head">
        <button className="icon-btn" onClick={() => nav("/g/home")} aria-label="뒤로 가기">
          ‹
        </button>
        <h1>약 복용 관리</h1>
        <button className="icon-btn" onClick={() => setTab("settings")} aria-label="약 추가">
          +
        </button>
      </header>

      <main className="screen-body">
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

        <SegTabs<Tab>
          current={tab}
          onChange={setTab}
          items={[
            { key: "list", label: "복용 약 목록" },
            { key: "settings", label: "복용 설정" },
          ]}
        />

        <Notice tone="error">{error}</Notice>
        {seniors.length === 0 && <Notice>먼저 부모님을 등록해 주세요.</Notice>}
        {!meds && seniorId && <Spinner />}

        {tab === "list" && meds && (
          <>
            {rows.length === 0 ? (
              <Notice>아직 등록된 약이 없습니다. `복용 설정`에서 추가해 주세요.</Notice>
            ) : (
              <section className="card med-list">
                {rows.map((r) => (
                  <div className="med-line" key={r.med.id + r.time}>
                    <Icon name={r.icon} className="lead" />
                    <span className="slot">{r.label}</span>
                    <span className="time">{r.time}</span>
                    <span className="name">{r.med.name}</span>
                    <button
                      className={`switch${r.med.is_active ? " on" : ""}`}
                      role="switch"
                      aria-checked={r.med.is_active}
                      aria-label={`${r.med.name} ${r.time} 알림`}
                      onClick={() => toggleActive(r.med)}
                    >
                      <span className="knob" />
                    </button>
                  </div>
                ))}
              </section>
            )}

            <Cheer icon="leafBranch">
              잊지 않으셔도 돼요
              <br />
              MEDIC이 함께 기억할게요.
            </Cheer>
          </>
        )}

        {tab === "settings" && seniorId && (
          <section className="form-card">
            <h2>
              <span className="tagcolor me" aria-hidden="true" />
              {current ? `${current.name} ${current.relation ?? ""} 약 추가` : "약 추가"}
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
                {times
                  .filter((t) => !PRESET_TIMES.includes(t))
                  .map((t) => (
                    <button key={t} className="time-pick on" onClick={() => toggleTime(t)} aria-pressed>
                      {t}
                    </button>
                  ))}
              </div>

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

            <BigButton tone="primary" onClick={save} disabled={!canSave}>
              {busy ? "저장하는 중…" : "저장"}
            </BigButton>
          </section>
        )}
      </main>
    </div>
  );
}
