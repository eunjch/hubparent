/** 화면 S1 — 부모용 메인 (리디자인 10_s_home).
 *
 *  아바타 + 인사 + 톱니 → 건강지수 카드(민트) → 2×2 타일 → 자녀에게 전화하기 → 탭바.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { Art } from "../shared/art";
import { clearTokens } from "../shared/auth";
import { Glyph } from "../shared/glyphs";
import { SeniorTabs } from "../shared/tabs";
import type { Me, Member } from "../shared/types";
import { BigButton, Notice, ScoreRing, Screen, Spinner, Tile, TileGrid } from "../shared/ui";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SeniorHome() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState<{ done: number; total: number } | null>(null);
  const [guardian, setGuardian] = useState<Member | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request<Me>("/me")
      .then(setMe)
      .catch(() => setError("정보를 불러오지 못했습니다. 잠시 후 다시 열어주세요."));
    // 하단 `자녀에게 전화하기` — 첫 번째 자녀
    request<Member[]>("/family/members")
      .then((rows) => setGuardian(rows.find((m) => m.role === "guardian") ?? null))
      .catch(() => setGuardian(null));
  }, []);

  // 오늘 얼마나 체크했는지 — 건강 지수의 근거.
  useEffect(() => {
    const day = today();
    Promise.all([
      request<{ status: string }[]>(`/checks/meals?check_date=${day}`),
      request<unknown[]>(`/checks/moods?check_date=${day}`),
      request<{ status: string }[]>("/medications/today"),
    ])
      .then(([meals, moods, doses]) => {
        const done =
          meals.filter((m) => m.status === "ate").length +
          moods.length +
          doses.filter((d) => d.status === "taken").length;
        setChecked({ done, total: 3 + 3 + doses.length });
      })
      .catch(() => setChecked({ done: 0, total: 6 }));
  }, []);

  async function signOut() {
    await clearTokens();
    nav("/", { replace: true });
  }

  if (error) {
    return (
      <Screen title="홈">
        <Notice tone="error">{error}</Notice>
        <BigButton onClick={signOut}>처음으로</BigButton>
      </Screen>
    );
  }

  if (!me) {
    return (
      <Screen title="홈">
        <Spinner />
      </Screen>
    );
  }

  const score = checked ? Math.round((checked.done / Math.max(checked.total, 1)) * 100) : 0;
  const remaining = checked ? checked.total - checked.done : 0;
  const condition =
    !checked || checked.done === 0
      ? "오늘을 시작해 볼까요?"
      : remaining === 0
        ? "오늘 기록을 다 하셨어요!"
        : `${remaining}가지 남았어요`;

  return (
    <div className="screen">
      <main className="screen-body">
        {/* 아바타 · 인사 · 톱니 (시안) */}
        <div className="hello">
          <Art name="avatarGrandma" className="avatar" />
          <div className="hello-text">
            <p className="t">
              안녕하세요,
              <br />
              {me.user.name} 어르신 <span aria-hidden="true">👋</span>
            </p>
            <p className="d">오늘도 건강한 하루 보내세요!</p>
          </div>
          <button className="gear" onClick={() => nav("/s/more")} aria-label="더보기">
            <Glyph name="gear" size={26} />
          </button>
        </div>

        {/* 건강지수 — 민트 카드, 링은 오른쪽 */}
        <section className="score-card">
          <div>
            <p className="t">오늘의 건강지수</p>
            <p className="d">오늘의 기록을 채워주세요</p>
            <p className="cond">{condition}</p>
          </div>
          <ScoreRing score={score} size="sm" />
        </section>

        <TileGrid>
          <Tile art="bowl" label="식사 체크" description="오늘 식사 기록하기" tone="meal" onClick={() => nav("/s/meal")} />
          <Tile art="capsuleRed" label="약 복용" description="지금 체크하기" tone="med" onClick={() => nav("/s/med")} />
          <Tile art="smileyPurple" label="기분 체크" description="오늘 기분 기록하기" tone="mood" onClick={() => nav("/s/mood")} />
          <Tile art="calendar" label="일정 확인" description="병원 일정 보기" tone="plan" onClick={() => nav("/s/schedule")} />
        </TileGrid>

        {/* 별도 연락처 화면 없이 여기서 바로 건다 (계획서 7.2 S1) */}
        {guardian && (
          <div className="help-bar">
            <span className="q">도움이 필요하신가요?</span>
            <a className="call" href={`tel:${guardian.phone}`}>
              <Glyph name="phone" size={24} />
              자녀에게 전화하기
            </a>
          </div>
        )}
      </main>

      <SeniorTabs current="home" />
    </div>
  );
}
