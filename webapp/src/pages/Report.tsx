/** 화면 G1-리포트 탭 — 하루를 자세히 본다 (계획서 7.1 G1 의 기분 변화 · 생활 패턴).
 *
 *  날짜 이동 ‹ › → 요약 4칸 → 기분 변화(아침·점심·저녁) → 식사 → 약 복용 → 생활 패턴(시간대별).
 *  홈은 "오늘 한눈에", 여기는 "그날 전부" 다.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { request } from "../shared/api";
import { Glyph } from "../shared/glyphs";
import { fileUrl } from "../shared/base";
import { Art, type ArtName, capsuleFor } from "../shared/art";
import { GuardianTabs, dateLabel, localDate, shiftDate } from "../shared/tabs";
import type {
  ActivityLevel,
  CheckSlot,
  Dose,
  FamilyReport,
  MealCheck,
  MoodValue,
  Senior,
} from "../shared/types";
import { Card, Notice, ScoreRing, SeniorChips, Spinner, StatusPill } from "../shared/ui";

interface ActivityReport {
  activity_level: ActivityLevel | null;
  steps: number;
  hours: { hour: number; steps: number; screen_on: number }[];
}

const SLOTS: { key: CheckSlot; label: string; icon: "sun" | "moon" }[] = [
  { key: "breakfast", label: "아침", icon: "sun" },
  { key: "lunch", label: "점심", icon: "sun" },
  { key: "dinner", label: "저녁", icon: "moon" },
];

const FACE: Record<MoodValue, ArtName> = { good: "emojiGood", normal: "emojiNormal", bad: "emojiBad" };
const MOOD_LABEL: Record<MoodValue, string> = { good: "좋아요", normal: "괜찮아요", bad: "힘들어요" };
const ACTIVITY_LABEL: Record<ActivityLevel, string> = { high: "활발", normal: "보통", low: "적음" };

export default function Report() {
  const [params, setParams] = useSearchParams();
  const [seniors, setSeniors] = useState<Senior[]>([]);
  const [seniorId, setSeniorId] = useState<string | null>(params.get("user_id"));
  const [day, setDay] = useState(params.get("date") ?? localDate());

  const [report, setReport] = useState<FamilyReport | null>(null);
  const [meals, setMeals] = useState<MealCheck[] | null>(null);
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [activity, setActivity] = useState<ActivityReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<Senior[]>("/family/seniors")
      .then((rows) => {
        setSeniors(rows);
        if (!seniorId && rows.length > 0) setSeniorId(rows[0].id);
      })
      .catch(() => setError("부모님 정보를 불러오지 못했습니다."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!seniorId) return;
    // 날짜나 부모님이 갈리면 늦게 온 응답은 버린다 (2026-09-11 점검)
    const state = { stale: false };
    setReport(null);
    setMeals(null);
    setDoses(null);
    setActivity(null);
    setError("");
    setParams({ user_id: seniorId, date: day }, { replace: true });

    // 하나가 실패해도 나머지는 보여 준다. 예전에는 활동 신호 한 건이 실패하면
    // 식사·약·기분까지 통째로 감춰졌다.
    const settle = <T,>(p: Promise<T>) => p.then((v) => v).catch(() => null);

    void Promise.all([
      settle(request<FamilyReport>(`/reports/family/${seniorId}?report_date=${day}`)),
      settle(request<MealCheck[]>(`/checks/meals?check_date=${day}&user_id=${seniorId}`)),
      settle(request<Dose[]>(`/medications/today?user_id=${seniorId}&day=${day}`)),
      settle(request<ActivityReport>(`/reports/activity/${seniorId}?report_date=${day}`)),
    ]).then(([r, m, d, a]) => {
      if (state.stale) return;
      setReport(r);
      setMeals(m);
      setDoses(d);
      setActivity(a);
      if (r === null) setError("기록을 불러오지 못했습니다.");
    });

    return () => {
      state.stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seniorId, day]);

  const isToday = day === localDate();
  const current = seniors.find((s) => s.id === seniorId);
  const r = report;
  const moodOf = (slot: CheckSlot) => r?.moods.find((m) => m.slot === slot)?.mood;
  const mealOf = (slot: CheckSlot) => meals?.find((m) => m.slot === slot);
  const maxSteps = Math.max(1, ...(activity?.hours.map((h) => h.steps) ?? [0]));

  return (
    <div className="screen">
      <header className="screen-head">
        <span className="icon-btn-space" />
        <h1>리포트</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        <SeniorChips seniors={seniors} current={seniorId} onChange={setSeniorId} />

        {/* 날짜 이동. 오늘 이후로는 못 간다 */}
        <div className="date-nav">
          <button className="icon-btn" onClick={() => setDay(shiftDate(day, -1))} aria-label="하루 전"><Glyph name="back" size={26} /></button>
          <span className="date-nav-label">
            {dateLabel(day)}
            {isToday && <span className="today-tag">오늘</span>}
          </span>
          <button
            className="icon-btn"
            onClick={() => setDay(shiftDate(day, 1))}
            disabled={isToday}
            aria-label="하루 뒤"
          >
            ›
          </button>
        </div>

        <Notice tone="error">{error}</Notice>
        {seniors.length === 0 && !error && <Notice>먼저 부모님을 등록해 주세요.</Notice>}
        {seniorId && !r && !error && <Spinner />}

        {r && current && (
          <>
            <Card title={`${current.name} ${current.relation ?? ""} 요약`}>
              <div className="summary-head">
                <ScoreRing score={r.score} />
                <span className="msg">
                  <span className="t">{r.summary_text}</span>
                  <span className="d">식사 · 기분 · 약 복용을 채운 비율이에요.</span>
                </span>
              </div>
              <div className="summary-grid">
                <span className="summary-cell">
                  <Art name="bowlSm" blend />
                  <span className="k">식사</span>
                  <span className="v">
                    {r.meal_done}/{r.meal_total}
                  </span>
                </span>
                <span className="summary-cell">
                  <Art name="capsuleSm" blend />
                  <span className="k">약 복용</span>
                  <span className="v">{r.med_total ? `${r.med_taken}/${r.med_total}` : "—"}</span>
                </span>
                <span className="summary-cell">
                  <Art name="runnerSm" blend />
                  <span className="k">활동</span>
                  <span className="v">{r.activity_level ? ACTIVITY_LABEL[r.activity_level] : "—"}</span>
                </span>
                <span className="summary-cell">
                  <Art name="smileySm" blend />
                  <span className="k">기분</span>
                  <span className="v">{r.moods.length}/3</span>
                </span>
              </div>
            </Card>

            {/* 기분 변화 — 시안 G1 */}
            <Card title="기분 변화">
              <div className="mood-trio">
                {SLOTS.map((s) => {
                  const m = moodOf(s.key);
                  return (
                    <span className={`mood-slot${m ? ` ${m}` : ""}`} key={s.key}>
                      <span className="face" aria-hidden="true">
                        {m ? <Art name={FACE[m]} /> : "·"}
                      </span>
                      <span className="k">{s.label}</span>
                      <span className="v">{m ? MOOD_LABEL[m] : "미기록"}</span>
                    </span>
                  );
                })}
              </div>
            </Card>

            <Card title="식사">
              {SLOTS.map((s) => {
                const m = mealOf(s.key);
                return (
                  <div className="detail-row" key={s.key}>
                    <span className={`slot-ic ${s.icon}`} aria-hidden="true">
                      <Glyph name={s.icon} size={20} />
                    </span>
                    <span className="t">{s.label}</span>
                    {m?.photo_path && (
                      <img className="thumb" src={fileUrl(m.photo_path!)} alt={`${s.label} 식사 사진`} />
                    )}
                    <StatusPill tone={m?.status === "ate" ? "done" : m ? "mid" : "none"}>
                      {m?.status === "ate" ? "먹었어요" : m ? "안 먹었어요" : "미기록"}
                    </StatusPill>
                  </div>
                );
              })}
            </Card>

            <Card title="약 복용">
              {doses && doses.length === 0 && <p className="sub">등록된 약이 없어요.</p>}
              {doses?.map((d, i) => (
                <div className="detail-row" key={d.medication_id + d.scheduled_at}>
                  <Art name={capsuleFor(i)} blend />
                  <span className="t">
                    <span className="time">{d.time}</span> {d.name}
                  </span>
                  <StatusPill tone={d.status === "taken" ? "done" : d.status === "missed" ? "mid" : "none"}>
                    {d.status === "taken" ? "먹었어요" : d.status === "missed" ? "안 먹었어요" : "응답 없음"}
                  </StatusPill>
                </div>
              ))}
            </Card>

            {/* 생활 패턴 — 시간대별 활동량 (시안 G1) */}
            <Card
              title="생활 패턴"
              action={
                <span className={`trend-badge ${activity?.activity_level ? "ok" : "mid"}`}>
                  {activity?.activity_level ? ACTIVITY_LABEL[activity.activity_level] : "기록 없음"}
                </span>
              }
            >
              {activity && activity.steps === 0 && (
                <p className="sub">이날 받은 활동 신호가 없어요. 휴대폰을 안 가지고 계셨을 수 있어요.</p>
              )}
              <div className="trend hours" aria-label="시간대별 활동량">
                {(activity?.hours ?? []).map((h) => (
                  <span className="trend-col" key={h.hour}>
                    <span className="bar-wrap">
                      <span
                        className="bar"
                        style={{ height: `${Math.max(4, Math.round((h.steps / maxSteps) * 100))}%` }}
                      />
                    </span>
                    <span className="lab">{h.hour % 6 === 0 ? `${String(h.hour).padStart(2, "0")}시` : ""}</span>
                  </span>
                ))}
              </div>
              {activity && activity.steps > 0 && (
                <p className="sub">하루 걸음 {activity.steps.toLocaleString()}보</p>
              )}
            </Card>
          </>
        )}
      </main>

      <GuardianTabs current="report" />
    </div>
  );
}
