/** 화면 S3 — 약 복용 체크 (리디자인 12_s_med).
 *
 *  자녀가 등록한 약이 오늘 시각·이름과 함께 카드로 나열되고, 각 카드에 "먹었어요 / 안 먹었어요".
 *  본인만 응답할 수 있다. 다시 누르면 마지막 답으로 바뀐다 (계획서 9장).
 */

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, request } from "../shared/api";
import { Art, capsuleFor } from "../shared/art";
import { pendingCount, send } from "../shared/offlineQueue";
import type { Dose, MedicationStatus } from "../shared/types";
import { Notice, Screen, Spinner, StatusPill } from "../shared/ui";

export default function MedCheck() {
  const nav = useNavigate();
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  // 오프라인 큐에 들어간 상태. 화면만 바뀌고 서버에는 없는 것을 숨기지 않는다.
  // 큐가 실제로 비면 안내도 사라져야 하므로 개수를 본다 (2026-09-11 재점검).
  const [pending, setPending] = useState(() => pendingCount() > 0);
  // 같은 약·시각의 연타를 막는 잠금. 상태는 같은 틱의 두 번째 클릭을 못 막아 ref 를 쓴다
  const sending = useRef(new Set<string>());

  useEffect(() => {
    request<Dose[]>("/medications/today")
      .then(setDoses)
      .catch(() => setError("오늘 드실 약을 불러오지 못했습니다."));
  }, []);

  async function answer(dose: Dose, status: MedicationStatus) {
    // 같은 칸을 연달아 누르는 것만 막는다. 화면 전체를 잠그면 아침을 누른 뒤
    // 점심을 못 누른다 — 실제로 그렇게 만들었다가 되돌린다 (2026-09-11 재점검).
    const key = dose.medication_id + dose.scheduled_at;
    if (sending.current.has(key)) return;
    sending.current.add(key);
    setBusy(key);
    setError("");

    // 화면을 먼저 바꾼다
    setDoses((prev) =>
      (prev ?? []).map((d) =>
        d.medication_id === dose.medication_id && d.scheduled_at === dose.scheduled_at ? { ...d, status } : d,
      ),
    );

    let saved: Dose | null = null;
    try {
      saved = await send<Dose>(`/medications/${dose.medication_id}/logs`, {
        method: "POST",
        body: { scheduled_at: dose.scheduled_at, status },
      });
    } catch (e) {
      // 서버가 거절한 것이다. 큐에 넣어도 영원히 실패하므로 바로 알린다
      setError(e instanceof ApiError ? e.message : "기록하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      sending.current.delete(key);
      setBusy(null);
      return;
    }
    setPending(saved === null);

    sending.current.delete(key);
    setBusy(null);
  }

  return (
    <Screen title="약 복용" onBack={() => nav("/s/home")}>
      {!doses && <Spinner />}
      <Notice tone="error">{error}</Notice>
      {pending && (
        <Notice tone="error">아직 서버에 보내지 못했어요. 인터넷이 연결되면 저절로 올라갑니다.</Notice>
      )}

      {doses?.length === 0 && (
        <Notice>오늘 드실 약이 없습니다. 자녀분이 등록하면 여기에 표시됩니다.</Notice>
      )}

      {doses && doses.length > 0 && (
        <>
          <div className="ask-head">
            <div>
              <p className="ask">약을 드셨나요?</p>
              <p className="ask-sub">
                건강한 하루를 위해
                <br />꼭 챙겨드세요.
              </p>
            </div>
            <Art name="capsuleRedW" className="ask-art" blend />
          </div>

          {doses.map((d, i) => {
            const key = d.medication_id + d.scheduled_at;
            const st =
              d.status === "taken"
                ? { tone: "done" as const, text: "복용 완료" }
                : d.status === "missed"
                  ? { tone: "mid" as const, text: "안 먹음" }
                  : { tone: "none" as const, text: "미복용" };
            return (
              <section className="card dose-card" key={key}>
                <div className="head">
                  <Art name={capsuleFor(i)} blend />
                  <div className="body">
                    <div className="nm">
                      {d.name}
                      {d.dose && <span className="dose">{d.dose}</span>}
                    </div>
                    <div className="when">{d.time}</div>
                  </div>
                  <StatusPill tone={st.tone}>{st.text}</StatusPill>
                </div>
                <div className="answers">
                  <button
                    className={`ans yes${d.status === "taken" ? " on" : ""}`}
                    onClick={() => answer(d, "taken")}
                    disabled={busy === key}
                    aria-pressed={d.status === "taken"}
                  >
                    먹었어요
                  </button>
                  <button
                    className={`ans no${d.status === "missed" ? " on" : ""}`}
                    onClick={() => answer(d, "missed")}
                    disabled={busy === key}
                    aria-pressed={d.status === "missed"}
                  >
                    안 먹었어요
                  </button>
                </div>
              </section>
            );
          })}
        </>
      )}
    </Screen>
  );
}
