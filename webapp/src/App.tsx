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

import { request } from "./shared/api";
import { hasSession, refreshSession } from "./shared/auth";
import type { Me } from "./shared/types";
import { flush } from "./shared/offlineQueue";
import { Screen, Spinner } from "./shared/ui";
import GuardianHome from "./pages/GuardianHome";
import GuardianSetup from "./pages/GuardianSetup";
import SeniorHome from "./pages/SeniorHome";
import InviteCode from "./pages/InviteCode";
import SeniorJoin from "./pages/SeniorJoin";
import Start from "./pages/Start";

type Boot = { state: "loading" } | { state: "anonymous" } | { state: "signed-in"; me: Me };

/** 저장된 세션이 있으면 역할에 맞는 홈으로 보낸다. */
function Landing({ boot }: { boot: Boot }) {
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

/** 토큰이 없으면 시작 화면으로 되돌린다. */
function Guarded({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  useEffect(() => {
    if (!hasSession()) nav("/", { replace: true });
  }, [nav]);
  return <>{children}</>;
}

export default function App() {
  const [boot, setBoot] = useState<Boot>({ state: "loading" });

  useEffect(() => {
    (async () => {
      if (!hasSession()) {
        setBoot({ state: "anonymous" });
        return;
      }
      try {
        const me = await request<Me>("/me");
        setBoot({ state: "signed-in", me });
      } catch {
        // access 가 만료됐을 수 있다. refresh 로 한 번 더 시도한다.
        if (await refreshSession()) {
          try {
            setBoot({ state: "signed-in", me: await request<Me>("/me") });
            return;
          } catch {
            /* 아래로 떨어진다 */
          }
        }
        setBoot({ state: "anonymous" });
      }
    })();
  }, []);

  // 오프라인 동안 쌓인 체크를 온라인 복귀 시 올린다(계획서 3장).
  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    void flush();
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing boot={boot} />} />

        {/* 온보딩 */}
        <Route path="/setup" element={<GuardianSetup />} />
        <Route path="/setup/code" element={<InviteCode />} />
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

        {/* 보호자 — 화면 7~8 은 M4 */}
        <Route
          path="/g/home"
          element={
            <Guarded>
              <GuardianHome />
            </Guarded>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
