/** 화면 S1-건강기록 탭 — 어르신이 자기 기록을 본다.
 *
 *  "오늘 무엇을 했나" 를 크게. 빠진 게 있으면 그 자리에서 채우러 갈 수 있다.
 *  계획서 9장: 한 화면에 한 가지, 글자는 크게, 색만으로 알리지 않는다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { Glyph } from "../shared/glyphs";
import { fileUrl } from "../shared/base";
import { Art, type ArtName, capsuleFor } from "../shared/art";
import { SeniorTabs, dateLabel, localDate, shiftDate } from "../shared/tabs";
import type { CheckSlot, Dose, FamilyReport, Me, MealCheck, MoodValue } from "../shared/types";
import { Card, Cheer, Notice, ScoreRing, Spinner, StatusPill } from "../shared/ui";

const SLOTS: { key: CheckSlot; label: string; icon: "sun" | "moon" }[] = [
  { key: "breakfast", label: "아침", icon: "sun" },
  { key: "lunch", label: "점심", icon: "sun" },
  { key: "dinner", label: "저녁", icon: "moon" },
];

const FACE: Record<MoodValue, ArtName> = { good: "emojiGood", normal: "emojiNormal", bad: "emojiBad" };
const MOOD_LABEL: Record<MoodValue, string> = { good: "좋아요", normal: "괜찮아요", bad: "힘들어요" };

export default function SeniorRecord() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [day, setDay] = useState(localDate());
  const [report, setReport] = useState<FamilyReport | null>(null);
  const [meals, setMeals] = useState<MealCheck[] | null>(null);
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<Me>("/me")
      .then(setMe)
      .catch(() => setError("정보를 불러오지 못했습니다."));
  }, []);

  useEffect(() => {
    if (!me) return;
    // 날짜를 연달아 넘기면 늦게 온 응답이 화면을 덮을 수 있다. 갈아탄 것은 버린다 (2026-09-11 점검)
    const state = { stale: false };
    setReport(null);
    setError("");

    // 하나가 실패해도 나머지는 보여 준다
    const settle = <T,>(p: Promise<T>) => p.then((v) => v).catch(() => null);

    void Promise.all([
      settle(request<FamilyReport>(`/reports/family/${me.user.id}?report_date=${day}`)),
      settle(request<MealCheck[]>(`/checks/meals?check_date=${day}`)),
      settle(request<Dose[]>(`/medications/today?day=${day}`)),
    ]).then(([r, m, d]) => {
      if (state.stale) return;
      setReport(r);
      setMeals(m);
      setDoses(d);
      if (r === null) setError("기록을 불러오지 못했습니다.");
    });

    return () => {
      state.stale = true;
    };
  }, [me, day]);

  const isToday = day === localDate();
  const r = report;
  const moodOf = (slot: CheckSlot) => r?.moods.find((m) => m.slot === slot)?.mood;
  const mealOf = (slot: CheckSlot) => meals?.find((m) => m.slot === slot);

  const allDone =
    r && r.meal_done === 3 && r.moods.length === 3 && (r.med_total === 0 || r.med_taken === r.med_total);

  return (
    <div className="screen">
      <header className="screen-head">
        <span className="icon-btn-space" />
        <h1>건강기록</h1>
        <span className="icon-btn-space" />
      </header>

      <main className="screen-body">
        <div className="date-nav big">
          <button className="icon-btn" onClick={() => setDay(shiftDate(day, -1))} aria-label="하루 전"><Glyph name="back" size={26} /></button>
          <span className="date-nav-label">
            {dateLabel(day)}
            {isToday && <span className="today-tag">오늘</span>}
          </span>
          <button className="icon-btn" onClick={() => setDay(shiftDate(day, 1))} disabled={isToday} aria-label="하루 뒤">
            ›
          </button>
        </div>

        <Notice tone="error">{error}</Notice>
        {!r && !error && <Spinner />}

        {r && (
          <>
            <div className="record-score">
              <ScoreRing score={r.score} />
              <div className="record-score-text">
                <p className="t">{allDone ? "오늘 기록을 다 하셨어요!" : isToday ? "아직 남은 기록이 있어요" : r.summary_text}</p>
                <p className="d">
                  식사 {r.meal_done}/3 · 기분 {r.moods.length}/3
                  {r.med_total > 0 ? ` · 약 ${r.med_taken}/${r.med_total}` : ""}
                </p>
              </div>
            </div>

            <Card title="식사" action={isToday ? <button className="link-btn" onClick={() => nav("/s/meal")}>기록하기 ›</button> : undefined}>
              {SLOTS.map((s) => {
                const m = mealOf(s.key);
                return (
                  <div className="detail-row big" key={s.key}>
                    <span className={`slot-ic ${s.icon}`} aria-hidden="true">
                      <Glyph name={s.icon} size={22} />
                    </span>
                    <span className="t">{s.label}</span>
                    {m?.photo_path && (
                      <img className="thumb" src={fileUrl(m.photo_path!)} alt={`${s.label} 식사 사진`} />
                    )}
                    <StatusPill tone={m?.status === "ate" ? "done" : m ? "mid" : "none"} withCheck={m?.status === "ate"}>
                      {m?.status === "ate" ? "먹었어요" : m ? "안 먹었어요" : "아직"}
                    </StatusPill>
                  </div>
                );
              })}
            </Card>

            <Card title="약 복용" action={isToday && doses && doses.length > 0 ? <button className="link-btn" onClick={() => nav("/s/med")}>기록하기 ›</button> : undefined}>
              {doses && doses.length === 0 && <p className="sub">등록된 약이 없어요.</p>}
              {doses?.map((d, i) => (
                <div className="detail-row big" key={d.medication_id + d.scheduled_at}>
                  <Art name={capsuleFor(i)} blend />
                  <span className="t">
                    <span className="time">{d.time}</span> {d.name}
                  </span>
                  <StatusPill tone={d.status === "taken" ? "done" : d.status === "missed" ? "mid" : "none"} withCheck={d.status === "taken"}>
                    {d.status === "taken" ? "먹었어요" : d.status === "missed" ? "안 먹었어요" : "아직"}
                  </StatusPill>
                </div>
              ))}
            </Card>

            <Card title="기분" action={isToday ? <button className="link-btn" onClick={() => nav("/s/mood")}>기록하기 ›</button> : undefined}>
              <div className="mood-trio big">
                {SLOTS.map((s) => {
                  const m = moodOf(s.key);
                  return (
                    <span className={`mood-slot${m ? ` ${m}` : ""}`} key={s.key}>
                      <span className="face" aria-hidden="true">
                        {m ? <Art name={FACE[m]} /> : "·"}
                      </span>
                      <span className="k">{s.label}</span>
                      <span className="v">{m ? MOOD_LABEL[m] : "아직"}</span>
                    </span>
                  );
                })}
              </div>
            </Card>

            {allDone && (
              <Cheer icon="leafBranch">
                오늘도 잘 챙기셨어요.
                <br />
                내일도 함께 기록해요.
              </Cheer>
            )}
          </>
        )}
      </main>

      <SeniorTabs current="record" />
    </div>
  );
}
