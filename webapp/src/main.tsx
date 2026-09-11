import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { applyTextScale, getTextScale } from "./shared/textScale";
import "./shared/tokens.css";
import "./shared/redesign.css";

// 첫 렌더 전에 걸어야 글자가 한 번 작게 떴다 커지지 않는다
applyTextScale(getTextScale());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
