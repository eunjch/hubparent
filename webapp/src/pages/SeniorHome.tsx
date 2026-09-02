/** 화면 1 — 어르신 홈.
 *
 *  시안(CONCEPT 4 부모님 화면): 하늘·언덕 배경 → 인사 → 세로 리스트 카드 5개 → 탭 4개.
 *  한 줄이 하나의 행동이고, 스크롤 없이 보이는 범위에 핵심 항목을 둔다(계획서 9장).
 *
 *  체크 3종의 실제 화면은 M2, 일정은 M3 에서 붙는다. 지금은 진입 카드까지다.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { request } from "../shared/api";
import { clearTokens } from "../shared/auth";
import {
  AvatarSenior,
  IconFamily,
  IconMeal,
  IconMed,
  IconMood,
  IconPlan,
  TabBell,
  TabChat,
  TabHome,
  TabSettings,
} from "../shared/icons";
import { Scene } from "../shared/Scene";
import type { Me } from "../shared/types";
import { BigButton, Greeting, MenuCard, MenuList, Notice, Screen, Spinner, TabBar } from "../shared/ui";

export default function SeniorHome() {
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");

  useEffect(() => {
    request<Me>("/me")
      .then(setMe)
      .catch(() => setError("정보를 불러오지 못했습니다. 잠시 후 다시 열어주세요."));
  }, []);

  async function signOut() {
    await clearTokens();
    nav("/", { replace: true });
  }

  const tabs = (
    <TabBar
      current={tab}
      items={[
        { key: "home", icon: (a) => <TabHome active={a} />, label: "홈", onClick: () => setTab("home") },
        { key: "alerts", icon: (a) => <TabBell active={a} />, label: "알림", onClick: () => setTab("alerts") },
        { key: "contacts", icon: (a) => <TabChat active={a} />, label: "연락처", onClick: () => setTab("contacts") },
        { key: "settings", icon: (a) => <TabSettings active={a} />, label: "설정", onClick: () => setTab("settings") },
      ]}
    />
  );

  if (error) {
    return (
      <Screen title="오늘">
        <Notice tone="error">{error}</Notice>
        <BigButton onClick={signOut}>처음으로</BigButton>
      </Screen>
    );
  }

  if (!me) {
    return (
      <Screen title="오늘">
        <Spinner />
      </Screen>
    );
  }

  if (tab !== "home") {
    return (
      <Screen sky tabs={tabs}>
        <Scene variant="senior" />
        <Notice>이 화면은 다음 단계에서 준비됩니다.</Notice>
        {tab === "settings" && (
          <div style={{ marginTop: "auto" }}>
            <BigButton onClick={signOut}>로그아웃</BigButton>
          </div>
        )}
      </Screen>
    );
  }

  return (
    <div className="screen sky">
      <Scene variant="senior" />

      <Greeting
        name={me.user.name}
        suffix="어머님"
        headline="안녕하세요! 😊"
        message="오늘도 건강한 하루 보내세요!"
        avatar={<AvatarSenior />}
        onBell={() => setTab("alerts")}
      />

      <main className="screen-body">
        <MenuList>
          <MenuCard
            icon={<IconMeal />}
            title="식사 체크"
            description="식사하셨는지 알려주세요"
            tone="meal"
            onClick={() => setTab("meal")}
          />
          <MenuCard
            icon={<IconMed />}
            title="약 복용 알림"
            description="약 드셨는지 확인해요"
            tone="med"
            onClick={() => setTab("med")}
          />
          <MenuCard
            icon={<IconMood />}
            title="기분 체크"
            description="오늘 기분을 선택해주세요"
            tone="mood"
            onClick={() => setTab("mood")}
          />
          <MenuCard
            icon={<IconPlan />}
            title="일정 확인"
            description="진료 일정, 가족 모임 확인"
            tone="plan"
            onClick={() => setTab("plan")}
          />
          <MenuCard
            icon={<IconFamily />}
            title="우리 가족 연락처"
            description="필요할 때 연락하세요"
            tone="contact"
            onClick={() => setTab("contacts")}
          />
        </MenuList>
      </main>

      {tabs}
    </div>
  );
}
