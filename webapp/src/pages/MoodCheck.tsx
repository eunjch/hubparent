/** 화면 S4 — 기분 체크 (리디자인 13_s_mood).
 *
 *  아침·점심·저녁 카드마다 이모지 세 개 중 하나를 고른다. 고르는 즉시 저장된다 —
 *  "저장하기" 를 따로 누르게 하지 않는다 (계획서 9장: 체크는 1탭 완료).
 */

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { Art, type ArtName } from "../shared/art";
import { Glyph } from "../shared/glyphs";
import { send } from "../shared/offlineQueue";
import { localDate } from "../shared/tabs";
import type { CheckSlot, MoodCheck as Mood, MoodValue } from "../shared/types";
import { Notice, Screen, Spinner } from "../shared/ui";

const SLOTS: { key: CheckSlot; label: string; icon: "sun" | "moon" }[] = [
  { key: "breakfast", label: "아침", icon: "sun" },
  { key: "lunch", label: "점심", icon: "sun" },
  { key: "dinner", label: "저녁", icon: "moon" },
];

/** 색만으로 구분하지 않는다. 글자를 항상 함께 쓴다 (계획서 9장). */
const MOODS: { key: MoodValue; label: string; art: ArtName }[] = [
  { key: "good", label: "좋아요", art: "emojiGood" },
  { key: "normal", label: "괜찮아요", art: "emojiNormal" },
  { key: "bad", label: "힘들어요", art: "emojiBad" },
];

/* 날짜는 기기 로컬(한국) 기준이다. toISOString() 은 UTC 라 오전 9시 이전에 전날이 나온다 —
 * 아침 기록이 통째로 어제로 들어가던 원인 (2026-09-11 점검). 서버도 읽을 때 KST 를 쓴다. */
const today = localDate;

export default function MoodCheck() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Mood[] | null>(null);
  const [busy, setBusy] = useState<CheckSlot | null>(null);
  const [error, setError] = useState("");
  // 오프라인 큐에 들어간 상태. 화면만 바뀌고 서버에는 없는 것을 숨기지 않는다
  const [pending, setPending] = useState(false);
  // 같은 틱의 연타를 막는 잠금. 상태로는 늦는다
  const sending = useRef(false);

  useEffect(() => {
    request<Mood[]>(`/checks/moods?check_date=${today()}`)
      .then(setRows)
      .catch(() => setError("기록을 불러오지 못했습니다."));
  }, []);

  async function choose(slot: CheckSlot, mood: MoodValue) {
    // 연타를 막는다. busy 는 상태라 같은 틱의 두 번째 클릭을 못 막는다 — ref 로 즉시 잠근다
    // (2026-09-11 점검)
    if (sending.current) return;
    sending.current = true;
    setBusy(slot);
    setError("");

    setRows((prev) => {
      const others = (prev ?? []).filter((r) => r.slot !== slot);
      const mine = (prev ?? []).find((r) => r.slot === slot);
      return [...others, { ...(mine ?? { id: "", check_date: today() }), slot, mood } as Mood];
    });

    const saved = await send<Mood>("/checks/moods", {
      method: "POST",
      body: { check_date: today(), slot, mood },
    });
    if (saved) {
      setRows((prev) => [...(prev ?? []).filter((r) => r.slot !== slot), saved]);
    }
    if (saved === null) {
      // 오프라인 큐에 들어갔다. 화면만 바뀌고 서버에는 없는 상태를 숨기지 않는다
      setPending(true);
    } else {
      setPending(false);
    }
    sending.current = false;
    setBusy(null);
  }

  const find = (slot: CheckSlot) => rows?.find((r) => r.slot === slot)?.mood;

  return (
    <Screen title="기분 체크" onBack={() => nav("/s/home")}>
      {!rows && <Spinner />}
      <Notice tone="error">{error}</Notice>
        {pending && (
          <Notice tone="error">
            아직 서버에 보내지 못했어요. 인터넷이 연결되면 저절로 올라갑니다.
          </Notice>
        )}

      {rows && (
        <>
          <div className="ask-head">
            <div>
              <p className="ask">오늘 기분은 어떠신가요?</p>
              <p className="ask-sub">지금 이 순간, 솔직하게 알려주세요.</p>
            </div>
          </div>

          {SLOTS.map((s) => (
            <section className="card mood-card" key={s.key}>
              <div className="slot">
                <Glyph name={s.icon} size={22} />
                {s.label}
              </div>
              <div className="faces">
                {MOODS.map((m) => {
                  const on = find(s.key) === m.key;
                  return (
                    <button
                      key={m.key}
                      className={`face-btn ${m.key}${on ? " on" : ""}`}
                      onClick={() => choose(s.key, m.key)}
                      disabled={busy === s.key}
                      aria-pressed={on}
                      aria-label={`${s.label} ${m.label}`}
                    >
                      <span className="tick" aria-hidden="true">
                        <Glyph name="check" size={12} stroke={3} />
                      </span>
                      <Art name={m.art} />
                      <span className="cap">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </Screen>
  );
}
