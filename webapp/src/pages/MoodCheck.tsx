/** 화면 S4 — 기분 체크 (리디자인 13_s_mood).
 *
 *  아침·점심·저녁 카드마다 이모지 세 개 중 하나를 고른다. 고르는 즉시 저장된다 —
 *  "저장하기" 를 따로 누르게 하지 않는다 (계획서 9장: 체크는 1탭 완료).
 */

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { Art, type ArtName } from "../shared/art";
import { Glyph } from "../shared/glyphs";
import { onQueueChange, pendingCount, send } from "../shared/offlineQueue";
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
  // 오프라인 큐에 들어간 상태. 화면만 바뀌고 서버에는 없는 것을 숨기지 않는다.
  // 큐가 실제로 비면 안내도 사라져야 하므로 개수를 본다 (2026-09-11 재점검).
  const [pending, setPending] = useState(() => pendingCount() > 0);
  // 같은 칸의 연타를 막는 잠금. 상태는 같은 틱의 두 번째 클릭을 못 막아 ref 를 쓴다
  const sending = useRef(new Set<string>());

  // 큐가 실제로 비면 안내도 사라진다
  useEffect(() => onQueueChange((n) => setPending(n > 0)), []);

  useEffect(() => {
    request<Mood[]>(`/checks/moods?check_date=${today()}`)
      .then(setRows)
      .catch(() => setError("기록을 불러오지 못했습니다."));
  }, []);

  async function choose(slot: CheckSlot, mood: MoodValue) {
    // 같은 칸을 연달아 누르는 것만 막는다. 화면 전체를 잠그면 아침을 누른 뒤
    // 점심을 못 누른다 — 실제로 그렇게 만들었다가 되돌린다 (2026-09-11 재점검).
    if (sending.current.has(slot)) return;
    sending.current.add(slot);
    setBusy(slot);
    setError("");

    setRows((prev) => {
      const others = (prev ?? []).filter((r) => r.slot !== slot);
      const mine = (prev ?? []).find((r) => r.slot === slot);
      return [...others, { ...(mine ?? { id: "", check_date: today() }), slot, mood } as Mood];
    });

    let saved: Mood | null = null;
    try {
      saved = await send<Mood>("/checks/moods", {
        method: "POST",
        body: { check_date: today(), slot, mood },
      });
    } catch (e) {
      // 서버가 거절한 것이다. 큐에 넣어도 영원히 실패하므로 바로 알린다
      setError(e instanceof ApiError ? e.message : "기록하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      sending.current.delete(slot);
      setBusy(null);
      return;
    }
    if (saved) {
      setRows((prev) => [...(prev ?? []).filter((r) => r.slot !== slot), saved]);
    }
    if (saved === null) {
      // 오프라인 큐에 들어갔다. 화면만 바뀌고 서버에는 없는 상태를 숨기지 않는다
      setPending(true);
    } else {
      setPending(false);
    }
    sending.current.delete(slot);
    setBusy(null);
  }

  const find = (slot: CheckSlot) => rows?.find((r) => r.slot === slot)?.mood;

  return (
    <Screen title="기분 체크" onBack={() => nav("/s/home")}>
      {!rows && <Spinner />}
      <Notice tone="error">{error}</Notice>
      {pending && (
        <Notice tone="error">아직 서버에 보내지 못했어요. 인터넷이 연결되면 저절로 올라갑니다.</Notice>
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
