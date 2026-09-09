/** 화면 G3 — 일정 관리 (자녀). 시안 "③ 일정 관리 (자녀가 설정)".
 *
 *  다가오는 일정 카드 + [부모님에게 알림 전송] → 전체 일정 목록 → 우상단 + 로 추가.
 *  계획서 7.3: 등록은 자녀만 한다. 어르신 화면은 읽기 전용이다.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { Glyph } from "../shared/glyphs";
import { Art, scheduleArt } from "../shared/art";
import type { IconName } from "../shared/icons";
import type { Schedule, ScheduleKind, Senior } from "../shared/types";
import { BigButton, Field, Notice, SeniorChips, Spinner } from "../shared/ui";

const KINDS: { key: ScheduleKind; label: string; icon: IconName }[] = [
  { key: "hospital", label: "병원 진료", icon: "stethoscope" },
  { key: "dental", label: "치과", icon: "tooth" },
  { key: "checkup", label: "건강검진", icon: "report" },
  { key: "family", label: "가족 모임", icon: "caregiver" },
  { key: "other", label: "기타", icon: "scheduleList" },
];

/** 계획서 8.5.6 의 사전 알림 선택지 */
const REMINDERS: { minutes: number; label: string }[] = [
  { minutes: 0, label: "정각" },
  { minutes: 10, label: "10분 전" },
  { minutes: 30, label: "30분 전" },
  { minutes: 60, label: "1시간 전" },
  { minutes: 120, label: "2시간 전" },
  { minutes: 1440, label: "하루 전" },
];

export function kindIcon(kind: ScheduleKind): IconName {
  return KINDS.find((k) => k.key === kind)?.icon ?? "scheduleList";
}

export function formatWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const hour = d.getHours();
  const ampm = hour < 12 ? "오전" : "오후";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return {
    date: `${d.getMonth() + 1}월 ${d.getDate()}일 (${week})`,
    time: `${ampm} ${h12}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

/** datetime-local 입력값("2026-09-20T14:00")을 그대로 로컬 시각으로 읽는다. */
function toIso(local: string): string {
  return new Date(local).toISOString();
}

/** ISO → datetime-local 값. 수정 폼에 기존 시각을 채울 때 쓴다. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ScheduleManage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [seniorId, setSeniorId] = useState<string | null>(params.get("user_id"));
  const [rows, setRows] = useState<Schedule[] | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [kind, setKind] = useState<ScheduleKind>("hospital");
  const [when, setWhen] = useState("");
  const [reminders, setReminders] = useState<number[]>([60]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    request<Senior[]>("/family/seniors")
      .then((list) => {
        setSeniors(list);
        if (!seniorId && list.length > 0) setSeniorId(list[0].id);
      })
      .catch(() => setError("부모님 정보를 불러오지 못했습니다."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!seniorId) return;
    try {
      setRows(await request<Schedule[]>(`/schedules?user_id=${seniorId}`));
    } catch {
      setError("일정을 불러오지 못했습니다.");
    }
  }, [seniorId]);

  useEffect(() => {
    setRows(null);
    void load();
    if (seniorId) setParams({ user_id: seniorId }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seniorId]);

  function toggleReminder(m: number) {
    setReminders((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => b - a),
    );
  }

  function resetForm() {
    setTitle("");
    setPlace("");
    setKind("hospital");
    setWhen("");
    setReminders([60]);
    setAdding(false);
    setEditing(null);
  }

  /** 기존 일정을 폼에 채운다 */
  function startEdit(row: Schedule) {
    setEditing(row);
    setTitle(row.title);
    setPlace(row.place ?? "");
    setKind(row.kind);
    setWhen(toLocalInput(row.start_at));
    setReminders(row.reminder_minutes);
    setAdding(true);
    window.scrollTo({ top: 0 });
  }

  async function save() {
    if (!seniorId) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        title: title.trim(),
        kind,
        start_at: toIso(when),
        place: place.trim() || null,
        reminder_minutes: reminders,
      };
      if (editing) {
        await request<Schedule>(`/schedules/${editing.id}`, { method: "PATCH", body });
      } else {
        await request<Schedule>("/schedules", {
          method: "POST",
          body: { target_user_id: seniorId, ...body },
        });
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function notify(row: Schedule) {
    setNote("");
    try {
      await request(`/schedules/${row.id}/notify`, { method: "POST" });
      setNote("부모님께 알림을 보냈어요.");
      await load();
    } catch {
      setError("알림을 보내지 못했습니다.");
    }
  }

  async function remove(row: Schedule) {
    if (!window.confirm(`${row.title} 일정을 지울까요?`)) return;
    try {
      await request(`/schedules/${row.id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
    }
  }

  const upcoming = rows?.filter((r) => r.upcoming) ?? [];
  const next = upcoming[0];
  const rest = rows?.filter((r) => r.id !== next?.id) ?? [];
  const canSave = title.trim().length > 0 && when.length > 0 && !busy;

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={() => nav("/g/home")} aria-label="뒤로 가기"><Glyph name="back" size={26} /></button>
        <h1>병원 일정</h1>
        <button
          className="icon-btn"
          onClick={() => (adding ? resetForm() : setAdding(true))}
          aria-label={adding ? "취소" : "일정 추가"}
        >{adding ? <Glyph name="close" size={24} /> : <Glyph name="plus" size={26} />}</button>
      </header>

      <main className="screen-body">
        <SeniorChips seniors={seniors} current={seniorId} onChange={setSeniorId} />

        <Notice tone="error">{error}</Notice>
        {note && <Notice>{note}</Notice>}
        {seniors.length === 0 && <Notice>먼저 부모님을 등록해 주세요.</Notice>}
        {!rows && seniorId && <Spinner />}

        {adding && (
          <section className="form-card">
            <h2>
              <span className="tagcolor me" aria-hidden="true" />
              {editing ? "일정 수정" : "일정 추가"}
            </h2>

            <div className="field">
              <span className="field-label">종류</span>
              <div className="kind-picks">
                {KINDS.map((k) => (
                  <button
                    key={k.key}
                    className={`kind-pick${kind === k.key ? " on" : ""}`}
                    onClick={() => setKind(k.key)}
                    aria-pressed={kind === k.key}
                  >
                    <Art name={scheduleArt(k.key)} blend />
                    <span>{k.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Field label="내용" value={title} onChange={setTitle} placeholder="내과 진료" autoFocus />

            <label className="field">
              <span className="field-label">날짜와 시간</span>
              <span className="field-wrap tail">
                <input
                  className="field-input"
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
                <Glyph name="calendar" size={20} />
              </span>
            </label>

            <Field label="장소" value={place} onChange={setPlace} placeholder="서울○○병원 (선택)" icon="pin" />

            <div className="field">
              <span className="field-label">알림</span>
              <div className="time-picks">
                {REMINDERS.map((r) => (
                  <button
                    key={r.minutes}
                    className={`time-pick${reminders.includes(r.minutes) ? " on" : ""}`}
                    onClick={() => toggleReminder(r.minutes)}
                    aria-pressed={reminders.includes(r.minutes)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <span className="field-hint">여러 개 고르면 각각 알림이 갑니다.</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <BigButton tone="primary" onClick={save} disabled={!canSave}>
                {busy ? "저장하는 중…" : "저장"}
              </BigButton>
              <BigButton onClick={resetForm}>취소</BigButton>
            </div>
          </section>
        )}

        {/* 다가오는 일정 — 시안은 이 카드가 가장 크다 */}
        {next && !adding && (
          <section className="card next-card">
            <div className="next-grid">
              <span className="dnum" aria-hidden="true">
                <span className="m">{new Date(next.start_at).getMonth() + 1}월</span>
                <span className="d">{new Date(next.start_at).getDate()}</span>
              </span>
              <div>
                <span className="when">{formatWhen(next.start_at).date}</span>
                <div className="sub">
                  <span>{formatWhen(next.start_at).time}</span>
                  <span>{next.place ? `${next.place} / ${next.title}` : next.title}</span>
                </div>
              </div>
              <span className="badge">다가오는 일정</span>
            </div>
            <button className="notify-btn" onClick={() => notify(next)}>
              <Glyph name="bell" size={22} />
              부모님에게 알림 전송
            </button>
            <div className="next-actions">
              <button className="text-btn" onClick={() => startEdit(next)}>
                수정
              </button>
              <button className="text-btn danger" onClick={() => remove(next)}>
                지우기
              </button>
            </div>
            {next.notified_at && (
              <p className="field-hint" style={{ marginTop: 6 }}>
                마지막 전송 {formatWhen(next.notified_at).time}
              </p>
            )}
          </section>
        )}

        {rows && rows.length === 0 && !adding && <Notice>아직 등록된 일정이 없습니다.</Notice>}

        {rest.length > 0 && (
          <>
            <div className="list-head">
              <span className="list-title">전체 일정</span>
              <span className="list-more">더보기 ›</span>
            </div>
            {rest.map((r) => {
              const w = formatWhen(r.start_at);
              return (
                <div className="sched-row" key={r.id}>
                  <Art name={scheduleArt(r.kind)} blend />
                  <div className="body">
                    <span className="t">{w.date}</span>
                    <span className="d">
                      {w.time} · {r.title}
                    </span>
                  </div>
                  <span className="row-actions">
                    <button className="row-edit" onClick={() => startEdit(r)} aria-label={`${r.title} 수정`}>
                      수정
                    </button>
                    <button className="row-del" onClick={() => remove(r)} aria-label={`${r.title} 지우기`}>
                      지우기
                    </button>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
