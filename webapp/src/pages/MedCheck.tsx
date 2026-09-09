/** 화면 S3 — 약 복용 체크 (리디자인 12_s_med).
 *
 *  자녀가 등록한 약이 오늘 시각·이름과 함께 카드로 나열되고, 각 카드에 "먹었어요 / 안 먹었어요".
 *  본인만 응답할 수 있다. 다시 누르면 마지막 답으로 바뀐다 (계획서 9장).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { Art, capsuleFor } from "../shared/art";
import { send } from "../shared/offlineQueue";
import type { Dose, MedicationStatus } from "../shared/types";
import { Notice, Screen, Spinner, StatusPill } from "../shared/ui";

export default function MedCheck() {
  const nav = useNavigate();
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<Dose[]>("/medications/today")
      .then(setDoses)
      .catch(() => setError("오늘 드실 약을 불러오지 못했습니다."));
  }, []);

  async function answer(dose: Dose, status: MedicationStatus) {
    const key = dose.medication_id + dose.scheduled_at;
    setBusy(key);
    setError("");

    // 화면을 먼저 바꾼다
    setDoses((prev) =>
      (prev ?? []).map((d) =>
        d.medication_id === dose.medication_id && d.scheduled_at === dose.scheduled_at ? { ...d, status } : d,
      ),
    );

    await send<Dose>(`/medications/${dose.medication_id}/logs`, {
      method: "POST",
      body: { scheduled_at: dose.scheduled_at, status },
    });

    setBusy(null);
  }

  return (
    <Screen title="약 복용" onBack={() => nav("/s/home")}>
      {!doses && <Spinner />}
      <Notice tone="error">{error}</Notice>

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
