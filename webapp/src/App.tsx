/** 라우팅.
 *
 *  어르신 앱과 보호자 앱은 같은 번들을 쓰고 로그인 후 role 로 갈린다(계획서 3장).
 *  경로 앞글자가 역할이다 — /s/* 어르신, /g/* 보호자.
 *
 *  진입 시 저장된 토큰으로 세션을 조용히 되살린다. 어르신에게 재로그인 화면을
 *  보이지 않는 것이 목표다(계획서 1.4).
 */

import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { afterLogin, bindBackButton, bindNavigator, isNativeApp, onResume } from "./native/bridge";
import { request } from "./shared/api";
import { clearTokens, hasSession, onSessionLost, refreshSession } from "./shared/auth";
import type { Me } from "./shared/types";
import { flush } from "./shared/offlineQueue";
import { Screen, Spinner } from "./shared/ui";
import Alerts from "./pages/Alerts";
import GuardianHome from "./pages/GuardianHome";
import GuardianMore from "./pages/GuardianMore";
import Report from "./pages/Report";
import SeniorMore from "./pages/SeniorMore";
import SeniorRecord from "./pages/SeniorRecord";
import PasswordReset from "./pages/PasswordReset";
import PolicyDoc from "./pages/PolicyDoc";
import Withdraw from "./pages/Withdraw";
import GuardianLogin from "./pages/GuardianLogin";
import GuardianSignup from "./pages/GuardianSignup";
import SeniorAdd from "./pages/SeniorAdd";
import MealCheck from "./pages/MealCheck";
import MedManage from "./pages/MedManage";
import ScheduleManage from "./pages/ScheduleManage";
import ScheduleView from "./pages/ScheduleView";
import MedCheck from "./pages/MedCheck";
import MoodCheck from "./pages/MoodCheck";
import SeniorHome from "./pages/SeniorHome";
import SeniorJoin from "./pages/SeniorJoin";
import SeniorList from "./pages/SeniorList";
import Start from "./pages/Start";

type Boot = { state: "loading" } | { state: "anonymous" } | { state: "signed-in"; me: Me };

/** 저장된 세션이 있으면 역할에 맞는 홈으로 보낸다.
 *
 *  `/` 에 올 때마다 새로 판단한다. 앱 시작 때 한 번만 계산하면
 *  로그아웃 뒤에도 "로그인됨" 으로 남아 홈으로 되돌려 보내는 핑퐁이 생긴다. */
function Landing() {
  const [boot, setBoot] = useState<Boot>({ state: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!hasSession()) {
        setBoot({ state: "anonymous" });
        return;
      }
      try {
        const me = await request<Me>("/me");
        if (alive) setBoot({ state: "signed-in", me });
        // 앱을 다시 열 때마다 푸시 토큰을 맞춘다
        void afterLogin(me.user.role);
      } catch {
        // access 가 만료됐을 수 있다. refresh 로 한 번 더 시도한다.
        if (await refreshSession()) {
          try {
            const me = await request<Me>("/me");
            if (alive) setBoot({ state: "signed-in", me });
            return;
          } catch {
            /* 아래로 떨어진다 */
          }
        }
        await clearTokens();
        if (alive) setBoot({ state: "anonymous" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (boot.state === "loading") {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }
  if (boot.state === "anonymous") return <Start />;
  return <Navigate to={boot.me.user.role === "senior" ? "/s/home" : "/g/home"} replace />;
}

/** 앱(Capacitor)에서만 도는 연결 — 알림 탭 이동 · 뒤로가기 · 복귀 시 재동기화.
 *  라우터 안에 있어야 navigate 를 쓸 수 있어 컴포넌트로 둔다. 웹에서는 아무것도 안 한다. */
function NativeBoot() {
  const nav = useNavigate();
  useEffect(() => {
    if (!isNativeApp()) return;
    bindNavigator((route) => nav(route));
    const offBack = bindBackButton(
      () => window.location.pathname !== "/" && !/^\/(s|g)\/home$/.test(window.location.pathname),
      () => nav(-1),
    );
    const offResume = onResume(() => {
      if (!hasSession()) return;
      void request("/heartbeat", { method: "POST" }).catch(() => undefined);
      // 오프라인이 아니라 "느려서" 밀린 것은 online 이벤트가 안 온다. 돌아올 때마다 비운다
      void flush();
    });
    return () => {
      offBack();
      offResume();
    };
  }, [nav]);
  return null;
}

/** 토큰이 없으면 시작 화면으로 되돌린다. */
function Guarded({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  useEffect(() => {
    if (!hasSession()) nav("/", { replace: true });
    // refresh 까지 만료되면 화면에 그대로 남아 "불러오지 못했습니다" 만 반복했다.
    // 세션이 끊긴 그 순간 첫 화면으로 보낸다 (2026-09-11 재점검).
    return onSessionLost(() => nav("/", { replace: true }));
  }, [nav]);
  return <>{children}</>;
}

export default function App() {
  // 오프라인 동안 쌓인 체크를 온라인 복귀 시 올린다(계획서 3장).
  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    void flush();
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <BrowserRouter>
      <NativeBoot />
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* 자녀 — 로그인 · 회원가입 */}
        <Route path="/login" element={<GuardianLogin />} />
        <Route path="/signup" element={<GuardianSignup />} />
        {/* 비밀번호 찾기 — 메일 속 링크가 /reset?token=... 으로 들어온다 */}
        {/* 방침은 앱 안에서 연다. target="_blank" 는 iOS 에서 안 열리고 안드로이드에서는 SPA 를 덮는다 */}
        <Route path="/privacy" element={<PolicyDoc />} />
        <Route path="/forgot" element={<PasswordReset />} />
        <Route path="/reset" element={<PasswordReset />} />

        {/* 부모 — 자녀 이름·번호로 들어온다 */}
        <Route path="/join" element={<SeniorJoin />} />

        {/* 어르신 — 화면 1~6, 9, 10 은 M2 이후 */}
        <Route
          path="/s/home"
          element={
            <Guarded>
              <SeniorHome />
            </Guarded>
          }
        />
        <Route
          path="/s/record"
          element={
            <Guarded>
              <SeniorRecord />
            </Guarded>
          }
        />
        <Route
          path="/s/more"
          element={
            <Guarded>
              <SeniorMore />
            </Guarded>
          }
        />
        <Route
          path="/s/meal"
          element={
            <Guarded>
              <MealCheck />
            </Guarded>
          }
        />
        <Route
          path="/s/med"
          element={
            <Guarded>
              <MedCheck />
            </Guarded>
          }
        />
        <Route
          path="/s/schedule"
          element={
            <Guarded>
              <ScheduleView />
            </Guarded>
          }
        />
        <Route
          path="/s/mood"
          element={
            <Guarded>
              <MoodCheck />
            </Guarded>
          }
        />

        {/* 보호자 */}
        <Route
          path="/g/home"
          element={
            <Guarded>
              <GuardianHome />
            </Guarded>
          }
        />
        <Route
          path="/g/report"
          element={
            <Guarded>
              <Report />
            </Guarded>
          }
        />
        <Route
          path="/g/more"
          element={
            <Guarded>
              <GuardianMore />
            </Guarded>
          }
        />
        <Route
          path="/g/alerts"
          element={
            <Guarded>
              <Alerts />
            </Guarded>
          }
        />
        <Route
          path="/g/schedules"
          element={
            <Guarded>
              <ScheduleManage />
            </Guarded>
          }
        />
        <Route
          path="/g/medications"
          element={
            <Guarded>
              <MedManage />
            </Guarded>
          }
        />
        <Route
          path="/g/seniors"
          element={
            <Guarded>
              <SeniorList />
            </Guarded>
          }
        />
        <Route
          path="/g/seniors/new"
          element={
            <Guarded>
              <SeniorAdd />
            </Guarded>
          }
        />
        <Route
          path="/g/seniors/:id"
          element={
            <Guarded>
              <SeniorAdd />
            </Guarded>
          }
        />

        {/* 탈퇴 — 자녀·부모님 같은 화면을 쓰고 역할에 따라 내용이 갈린다 */}
        <Route
          path="/withdraw"
          element={
            <Guarded>
              <Withdraw />
            </Guarded>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
