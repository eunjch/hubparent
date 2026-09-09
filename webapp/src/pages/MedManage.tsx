/** 화면 G4 — 약 복용 관리 (자녀). 시안 "④ 약 복용 시간 설정".
 *
 *  세그먼트 탭 `복용 약 목록 / 복용 설정`.
 *  목록: 날짜를 넘기며 그날 먹어야 할 약과 응답(먹었어요/안 먹었어요/아직) + 알림 토글.
 *  설정: 약 추가 폼. 부모 화면(S3)은 오늘 것만 본다 — 여기는 지난 날도 돌아볼 수 있다.
 *  계획서 7.3: 약 복용 시간은 자녀가 설정한다. 어르신은 응답만 한다.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { Backdrop, Icon } from "../shared/icons";
import { dateLabel, localDate, shiftDate } from "../shared/tabs";
import type { Dose, Medication, Senior } from "../shared/types";
import { BigButton, Cheer, Field, Notice, SegTabs, Spinner } from "../shared/ui";

type Tab = "list" | "settings";

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
  const [day, setDay] = useState(localDate());
  const [doses, setDoses] = useState<Dose[] | null>(null);
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

  // 그날 먹어야 할 약 — 규칙을 날짜에 펼친 것. 규칙이 바뀌면(meds) 같이 다시 읽는다
  useEffect(() => {
    if (!seniorId) return;
    setDoses(null);
    request<Dose[]>(`/medications/today?user_id=${seniorId}&day=${day}`)
      .then(setDoses)
      .catch(() => setError("복용 현황을 불러오지 못했습니다."));
  }, [seniorId, day, meds]);

  function removeTime(t: string) {
    setTimes((prev) => prev.filter((x) => x !== t));
  }

  /** 시각 입력(type=time)의 값을 목록에 넣는다. 같은 시각은 한 번만. */
  function addCustomTime() {
    const t = customTime.trim();
    if (!TIME_PATTERN.test(t)) {
      setError("시각을 골라 주세요.");
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

  const isToday = day === localDate();
  const isFuture = day > localDate();
  const medById = new Map((meds ?? []).map((m) => [m.id, m]));
  const inactive = (meds ?? []).filter((m) => !m.is_active);

  function doseLabel(d: Dose): { tone: "done" | "mid" | "none"; text: string } {
    if (d.status === "taken") return { tone: "done", text: "먹었어요" };
    if (d.status === "missed") return { tone: "mid", text: "안 먹었어요" };
    return { tone: "none", text: isFuture ? "예정" : "아직" };
  }

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
            {/* 날짜 이동 — 지난 날 복용 현황을 돌아보고, 앞날 예정도 본다 */}
            <div className="date-nav">
              <button className="icon-btn" onClick={() => setDay(shiftDate(day, -1))} aria-label="하루 전">
                ‹
              </button>
              <span className="date-nav-label">
                {dateLabel(day)}
                {isToday && <span className="today-tag">오늘</span>}
              </span>
              <button className="icon-btn" onClick={() => setDay(shiftDate(day, 1))} aria-label="하루 뒤">
                ›
              </button>
            </div>

            {meds.length === 0 ? (
              <Notice>아직 등록된 약이 없습니다. `복용 설정`에서 추가해 주세요.</Notice>
            ) : !doses ? (
              <Spinner />
            ) : doses.length === 0 ? (
              <Notice>이날 먹을 약이 없어요.</Notice>
            ) : (
              <section className="card med-list">
                {doses.map((d) => {
                  const med = medById.get(d.medication_id);
                  const slot = slotOf(d.time);
                  const st = doseLabel(d);
                  return (
                    <div className="med-line" key={d.medication_id + d.scheduled_at}>
                      <Icon name={slot.icon} className="lead" />
                      <span className="slot">{slot.label}</span>
                      <span className="time">{d.time}</span>
                      <span className="name">
                        <span className="nm">
                          {d.name}
                          {d.dose ? <span className="dose"> {d.dose}</span> : null}
                        </span>
                        <span className={`status ${st.tone}`}>{st.text}</span>
                      </span>
                      {med && (
                        <button
                          className={`switch${med.is_active ? " on" : ""}`}
                          role="switch"
                          aria-checked={med.is_active}
                          aria-label={`${med.name} 알림`}
                          onClick={() => toggleActive(med)}
                        >
                          <span className="knob" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* 꺼 둔 약은 날짜 목록에 안 나온다. 다시 켤 수 있게 따로 보여 준다 */}
            {inactive.length > 0 && (
              <section className="card med-list off">
                <p className="med-list-title">알림 꺼 둔 약</p>
                {inactive.map((m) => (
                  <div className="med-line" key={m.id}>
                    <Icon name="pills" className="lead" />
                    <span className="time">{m.times.join(" · ")}</span>
                    <span className="name">{m.name}</span>
                    <button
                      className="switch"
                      role="switch"
                      aria-checked={false}
                      aria-label={`${m.name} 알림 켜기`}
                      onClick={() => toggleActive(m)}
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
              {/* 시각을 고르고 [추가]. 고른 것은 알약 모양으로 쌓이고 × 로 뺀다 */}
              <div className="time-add">
                <input
                  className="field-input"
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  aria-label="복용 시각"
                />
                <button className="time-add-btn" onClick={addCustomTime} disabled={!customTime}>
                  추가
                </button>
              </div>

              {times.length > 0 && (
                <div className="time-picks">
                  {times.map((t) => (
                    <button
                      key={t}
                      className="time-pick on"
                      onClick={() => removeTime(t)}
                      aria-label={`${t} 빼기`}
                    >
                      {t} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              )}
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
