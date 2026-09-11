/** 화면 G2 — 이상 징후 알림 (자녀). 시안 "② 이상 징후 알림".
 *
 *  부모님 칩(둘 이상일 때) → 필터 탭 `전체 / 이상 징후 / 일반` →
 *  이상 징후 카드(적색, `상세 확인`) → 일반 알림 목록 → `모두 확인했어요`.
 *  계획서 8.2: 확인(ack)하면 같은 유형이 다시 생길 수 있다. 확인이 곧 "봤다"는 뜻이다.
 *
 *  서버는 처음부터 부모님별로 갈라 줬는데(/alerts?user_id=, ack-all 의 user_id)
 *  화면이 그걸 안 써서 여러 분의 알림이 한 덩어리로 섞여 나왔다 (2026-09-11).
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { request } from "../shared/api";
import { Art, type ArtName } from "../shared/art";
import { Glyph, type GlyphName } from "../shared/glyphs";
import { GuardianTabs } from "../shared/tabs";
import type { Alert, AlertList, AlertType, Senior } from "../shared/types";
import { Notice, Screen, SegTabs, SeniorChips, Spinner } from "../shared/ui";

type Filter = "all" | "anomaly" | "general";

const TYPE_LABEL: Record<AlertType, string> = {
  no_response: "응답 없음",
  no_checks: "체크 미완료",
  missed_med: "약 복용 미체크",
};

const TYPE_ART: Record<AlertType, ArtName> = {
  no_response: "bellRed",
  no_checks: "smileySm",
  missed_med: "capsuleSm",
};

const DISCLAIMER = "의료적 진단이 아닌 참고용 정보입니다.";

/** 서버 문구 끝의 면책 문장은 따로 작게 보여 준다 (시안) */
function splitMessage(message: string): { body: string; note: string | null } {
  const i = message.indexOf(DISCLAIMER);
  if (i < 0) return { body: message, note: null };
  return { body: message.slice(0, i).trim(), note: DISCLAIMER };
}

const _glyphs: GlyphName[] = ["warning"];
void _glyphs;

/** "오늘 11:23" · "9/7 08:30" */
export function whenLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? `오늘 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

export default function Alerts() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [seniors, setSeniors] = useState<Senior[]>([]);
  // null = 전체. 홈의 종을 눌러 들어오면 그때 보던 부모님이 주소에 실려 온다
  const [seniorId, setSeniorId] = useState<string | null>(params.get("user_id"));
  const [data, setData] = useState<AlertList | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<Senior[]>("/family/seniors")
      .then(setSeniors)
      .catch(() => undefined); // 칩이 안 떠도 알림 목록은 봐야 한다
  }, []);

  const load = useCallback(
    async (state?: { stale: boolean }) => {
      try {
        const q = seniorId ? `&user_id=${seniorId}` : "";
        const rows = await request<AlertList>(`/alerts?filter=${filter}${q}`);
        if (state?.stale) return;
        setData(rows);
        setError("");
      } catch {
        if (state?.stale) return;
        setError("알림을 불러오지 못했습니다.");
      }
    },
    [filter, seniorId],
  );

  useEffect(() => {
    // 필터를 연달아 바꾸면 늦게 온 응답이 화면을 덮을 수 있다. 갈아탄 것은 버린다 (2026-09-11 점검)
    const state = { stale: false };
    setData(null);
    setError("");
    setParams(seniorId ? { user_id: seniorId } : {}, { replace: true });
    void load(state);
    return () => {
      state.stale = true;
    };
    // setParams 는 매 렌더 새로 만들어져 넣으면 무한히 돈다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const [busy, setBusy] = useState(false);

  async function ack(row: Alert) {
    if (busy) return;
    setBusy(true);
    try {
      await request(`/alerts/${row.id}/ack`, { method: "POST" });
      await load();
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function ackAll() {
    if (busy) return;
    setBusy(true);
    try {
      // 보고 있는 분의 것만 확인한다. 전체를 보고 있을 때만 전부 (2026-09-11)
      await request("/alerts/ack-all", { method: "POST", body: seniorId ? { user_id: seniorId } : {} });
      await load();
    } catch {
      setError("잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items ?? [];
  // 미확인 이상 징후는 카드로 크게, 나머지는 목록으로
  const cards = items.filter((a) => a.severity !== "low" && !a.ack_at);
  const rows = items.filter((a) => !cards.includes(a));

  return (
    // 하단 탭 `알림` 이 여기로 온다
    <Screen title="알림" onBack={() => nav("/g/home")} tabs={<GuardianTabs current="alerts" />}>
      {/* 부모님이 둘 이상이면 누구 알림인지 갈라 본다. 일정·복약 화면과 같은 칩이다 */}
      <SeniorChips
        seniors={seniors}
        current={seniorId}
        onChange={setSeniorId}
        allLabel="전체"
        onAll={() => setSeniorId(null)}
      />

      <SegTabs<Filter>
        current={filter}
        onChange={setFilter}
        className="alert-seg"
        items={[
          { key: "all", label: "전체" },
          { key: "anomaly", label: "이상 징후" },
          { key: "general", label: "일반" },
        ]}
      />

      <Notice tone="error">{error}</Notice>
      {!data && !error && <Spinner />}

      {data && items.length === 0 && <Notice>새로운 알림이 없어요.</Notice>}

      {cards.map((a) => (
        <section className="alert-card" key={a.id} aria-label="이상 징후">
          <div className="alert-head">
            <div className="body">
              <div className="row">
                <span className="t">
                  <Glyph name="warning" size={26} />
                  이상 징후 감지
                </span>
                <span className="when">{whenLabel(a.occurred_at)}</span>
              </div>
              <p className="msg">
                {a.target_name} — {splitMessage(a.message).body}
              </p>
              {splitMessage(a.message).note && <p className="disclaimer">{splitMessage(a.message).note}</p>}
            </div>
          </div>
          <button className="alert-detail" disabled={busy} onClick={() => ack(a)}>
            상세 확인
          </button>
        </section>
      ))}

      {rows.map((a) => (
        <button
          className={`alert-row${a.ack_at ? " read" : ""}`}
          key={a.id}
          disabled={busy}
          onClick={() => !a.ack_at && ack(a)}
          aria-label={`${TYPE_LABEL[a.type]} ${a.ack_at ? "확인함" : "확인하기"}`}
        >
          <Art name={TYPE_ART[a.type]} blend />
          <span className="body">
            <span className="t">
              {TYPE_LABEL[a.type]}
              {a.target_name ? ` · ${a.target_name}` : ""}
            </span>
            <span className="d">{a.message}</span>
          </span>
          <span className="when">{whenLabel(a.occurred_at)}</span>
        </button>
      ))}

      {data && data.unread > 0 && (
        <button className="ack-all" disabled={busy} onClick={ackAll}>
          {busy ? "확인하는 중…" : "모두 확인했어요"}
        </button>
      )}
    </Screen>
  );
}
