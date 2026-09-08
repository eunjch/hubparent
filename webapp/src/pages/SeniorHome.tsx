/** 화면 S1 — 부모용 메인 (시안 "① 메인 화면 (4가지 메뉴)").
 *
 *  인사 + 건강지수(오른쪽 카드) → 2×2 타일 4개 → 탭바 4개.
 *  탭은 홈 · 건강기록 · 일정 · 더보기 다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import { Backdrop, Icon } from "../shared/icons";
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
  // M4 에서 서버 리포트가 붙으면 그 값으로 바꾼다.
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
  const condition =
    !checked || checked.done === 0
      ? "오늘을 시작해 볼까요?"
      : checked.done === checked.total
        ? "좋은 컨디션이에요!"
        : `${checked.total - checked.done}가지 남았어요`;

  return (
    <div className="screen decorated">
      <Backdrop variant="leaf" />

      <main className="screen-body">
        {/* 인사와 건강지수가 한 줄에 나란히 선다 (시안) */}
        <div className="hello">
          <div className="hello-text">
            <p className="t">
              안녕하세요,
              <br />
              {me.user.name} 어르신 <span aria-hidden="true">👋</span>
            </p>
            <p className="d">오늘도 건강한 하루 보내세요!</p>
          </div>
          <div className="hello-score">
            <span className="label">오늘의 건강지수</span>
            <ScoreRing score={score} size="sm" />
            <span className="cond">{condition}</span>
          </div>
        </div>

        <TileGrid>
          <Tile
            icon="meal"
            label="식사 체크"
            description="오늘 식사 기록하기"
            tone="meal"
            onClick={() => nav("/s/meal")}
          />
          <Tile
            icon="pills"
            label="약 복용"
            description="지금 체크하기"
            tone="med"
            onClick={() => nav("/s/med")}
          />
          <Tile
            icon="mood"
            label="기분 체크"
            description="오늘 기분 기록하기"
            tone="mood"
            onClick={() => nav("/s/mood")}
          />
          <Tile
            icon="calendar"
            label="일정 확인"
            description="병원 일정 보기"
            tone="plan"
            onClick={() => nav("/s/schedule")}
          />
        </TileGrid>

        {/* 별도 연락처 화면 없이 여기서 바로 건다 (계획서 7.2 S1) */}
        {guardian && (
          <div className="help-bar">
            <span className="q">도움이 필요하신가요?</span>
            <a className="call" href={`tel:${guardian.phone}`}>
              <Icon name="phone" />
              자녀에게 전화하기
            </a>
          </div>
        )}
      </main>

      <SeniorTabs current="home" />
    </div>
  );
}
