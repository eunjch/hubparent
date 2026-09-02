/** 화면 7 — 자녀 홈 (엄마 리포트).
 *
 *  시안(CONCEPT 4 자녀 화면)을 따른다.
 *  인사 → 오늘 한눈에 보기(4칸) → 2×2 기능 카드 → 오늘 건강 리포트 배너 → 탭 5개.
 *
 *  식사·기분은 이미 API 가 있어 실제 값을 보여준다.
 *  약 복용·일정은 M3 에 API 가 붙으므로 그때까지 "—" 로 둔다 — 0 으로 표시하면
 *  "오늘 한 번도 안 드셨다"는 뜻이 되어 오해를 만든다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import type { Me } from "../shared/types";
import {
  BigButton,
  Card,
  Greeting,
  MenuCard,
  MenuGrid,
  Notice,
  Screen,
  Spinner,
  Stat,
  StatRow,
  TabBar,
} from "../shared/ui";

interface MealCheck {
  slot: string;
  status: "ate" | "skipped";
}

interface MoodCheck {
  slot: string;
  mood: "good" | "normal" | "bad";
}

const MOOD_LABEL: Record<string, string> = { good: "좋음", normal: "보통", bad: "나쁨" };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(): string {
  const d = new Date();
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${week})`;
}

export default function GuardianHome() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [seniorId, setSeniorId] = useState<string | null>(null);
  const [meals, setMeals] = useState<MealCheck[] | null>(null);
  const [moods, setMoods] = useState<MoodCheck[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");

  useEffect(() => {
    (async () => {
      try {
        const info = await request<Me>("/me");
        setMe(info);
        if (!info.family_id) return;

        const members = await request<{ user_id: string; role: string; name: string }[]>(
          `/families/${info.family_id}/members`,
        );
        const senior = members.find((m) => m.role === "senior");
        if (!senior) return;
        setSeniorId(senior.user_id);

        const day = today();
        const [m, o] = await Promise.all([
          request<MealCheck[]>(`/checks/meals?check_date=${day}&user_id=${senior.user_id}`),
          request<MoodCheck[]>(`/checks/moods?check_date=${day}&user_id=${senior.user_id}`),
        ]);
        setMeals(m);
        setMoods(o);
      } catch {
        setError("정보를 불러오지 못했습니다.");
      }
    })();
  }, []);

  async function signOut() {
    await clearTokens();
    nav("/", { replace: true });
  }

  const tabs = (
    <TabBar
      current={tab}
      items={[
        { key: "home", icon: "🏠", label: "홈", onClick: () => setTab("home") },
        { key: "report", icon: "📄", label: "리포트", onClick: () => setTab("report") },
        { key: "alerts", icon: "🔔", label: "알림", onClick: () => setTab("alerts") },
        { key: "contacts", icon: "☎️", label: "연락처", onClick: () => setTab("contacts") },
        { key: "more", icon: "⋯", label: "더보기", onClick: () => setTab("more") },
      ]}
    />
  );

  if (error) {
    return (
      <Screen title="부모님">
        <Notice tone="error">{error}</Notice>
        <BigButton onClick={signOut}>처음으로</BigButton>
      </Screen>
    );
  }

  if (!me) {
    return (
      <Screen title="부모님">
        <Spinner />
      </Screen>
    );
  }

  if (tab !== "home") {
    return (
      <Screen sky tabs={tabs}>
        <Notice>이 화면은 다음 단계에서 준비됩니다.</Notice>
        {tab === "more" && (
          <div style={{ marginTop: "auto" }}>
            <BigButton onClick={signOut}>로그아웃</BigButton>
          </div>
        )}
      </Screen>
    );
  }

  const mealDone = meals?.filter((m) => m.status === "ate").length;
  const moodValue = moods?.length ? MOOD_LABEL[moods[moods.length - 1].mood] : null;

  return (
    <Screen sky tabs={tabs}>
      <Greeting
        name={me.user.name}
        message="좋은 하루 보내세요!"
        avatar="🙋‍♀️"
        onBell={() => setTab("alerts")}
      />

      {!seniorId && <Notice>아직 부모님이 연결되지 않았습니다. 알려드린 번호를 확인해 주세요.</Notice>}

      <Card title="오늘 한눈에 보기" date={formatDate()}>
        <StatRow>
          <Stat icon="🍚" label="식사" value={mealDone === undefined ? "—" : `${mealDone}/3`} />
          <Stat icon="💊" label="약 복용" value="—" />
          <Stat icon="😊" label="기분" value={moodValue ?? "—"} />
          <Stat icon="📅" label="일정" value="—" />
        </StatRow>
      </Card>

      <MenuGrid>
        <MenuCard icon="🍚" title="식사 체크" description="식사하셨나요?" tone="meal" onClick={() => setTab("meal")} />
        <MenuCard icon="💊" title="약 복용 알림" description="복용 시간 확인하기" tone="med" onClick={() => setTab("med")} />
        <MenuCard icon="😊" title="기분 체크" description="오늘 기분은 어때요?" tone="mood" onClick={() => setTab("mood")} />
        <MenuCard icon="📅" title="일정 확인" description="병원 일정, 모임 확인" tone="plan" onClick={() => setTab("plan")} />
      </MenuGrid>

      <MenuCard
        icon="📋"
        title="오늘 건강 리포트"
        description="건강 기록과 변화 추이를 확인해보세요."
        tone="plain"
        onClick={() => setTab("report")}
      />
    </Screen>
  );
}
