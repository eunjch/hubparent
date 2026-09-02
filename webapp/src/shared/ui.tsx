/** 공용 컴포넌트 — CONCEPT 4 "패밀리 캐릭터".
 *
 *  계획서 9장의 고령자 UX 기준은 취향이 아니라 수용 기준이다.
 *  본문 18px · 버튼 24px · 터치 56px · 대비 4.5:1 · 색만으로 상태를 구분하지 않음.
 *  값은 tokens.css 에 있고 여기서는 토큰만 쓴다 — 인라인으로 px 를 적지 않는다.
 *
 *  아이콘은 지금 이모지로 둔다. 시안의 캐릭터 일러스트는 별도 산출물이며,
 *  받는 대로 이 컴포넌트들의 ico 자리만 교체하면 된다 (계획서 15장).
 */

import type { CSSProperties, ReactNode } from "react";

export type Tone = "meal" | "med" | "mood" | "plan" | "contact" | "plain";

/* ── 화면 뼈대 ──────────────────────────────────────────────── */

export function Screen({
  title,
  onBack,
  sky,
  children,
  footer,
  tabs,
}: {
  title?: string;
  onBack?: () => void;
  /** 홈 화면처럼 위쪽에 하늘 배경을 깔지 여부 */
  sky?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <div className={`screen${sky ? " sky" : ""}`}>
      {title && (
        <header className="screen-head">
          {onBack ? (
            <button className="icon-btn" onClick={onBack} aria-label="뒤로 가기">
              ‹
            </button>
          ) : (
            <span className="icon-btn-space" />
          )}
          <h1>{title}</h1>
          <span className="icon-btn-space" />
        </header>
      )}
      <main className="screen-body">{children}</main>
      {footer && <footer className="screen-foot">{footer}</footer>}
      {tabs}
    </div>
  );
}

/** 홈 상단 인사. 시안의 아바타 + 인사말 + 알림 벨. */
export function Greeting({
  name,
  suffix,
  message,
  avatar = "🙂",
  onBell,
  alertCount = 0,
}: {
  name: string;
  /** "어머님" 같은 호칭. 자녀 화면에서는 "님" */
  suffix?: string;
  message: string;
  avatar?: string;
  onBell?: () => void;
  alertCount?: number;
}) {
  return (
    <div className="greet">
      <span className="greet-avatar" aria-hidden="true">
        {avatar}
      </span>
      <div className="greet-text">
        <p className="greet-name">
          {name} {suffix ?? "님"}
        </p>
        <p className="greet-sub">{message}</p>
      </div>
      {onBell && (
        <button
          className="icon-btn"
          onClick={onBell}
          aria-label={alertCount > 0 ? `알림 ${alertCount}건` : "알림"}
          style={{ fontSize: 24 }}
        >
          {alertCount > 0 ? "🔔" : "🔕"}
        </button>
      )}
    </div>
  );
}

/* ── 카드 ───────────────────────────────────────────────────── */

export function Card({
  title,
  date,
  action,
  children,
}: {
  title?: string;
  date?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      {title && (
        <div className="card-title">
          <div>
            <h2>{title}</h2>
            {date && <span className="date">{date}</span>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** 오늘 한눈에 보기의 한 칸. 값이 없으면 "—" 로 둔다 — 0 과 구분해야 한다. */
export function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="stat">
      <span className="ico" aria-hidden="true">
        {icon}
      </span>
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="stat-row">{children}</div>;
}

/** 기능 진입 카드. 어르신 화면은 리스트, 자녀 화면은 2×2 그리드로 배치된다. */
export function MenuCard({
  icon,
  title,
  description,
  tone = "plain",
  onClick,
  disabled,
}: {
  icon: string;
  title: string;
  description?: string;
  tone?: Tone;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button className={`menu-card tone-${tone}`} onClick={onClick} disabled={disabled}>
      <span className="ico" aria-hidden="true">
        {icon}
      </span>
      <span className="body">
        <span className="t">{title}</span>
        {description && <span className="d">{description}</span>}
      </span>
      <span className="chev" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

export function MenuGrid({ children }: { children: ReactNode }) {
  return <div className="menu-grid">{children}</div>;
}

export function MenuList({ children }: { children: ReactNode }) {
  return <div className="menu-list">{children}</div>;
}

/* ── 하단 탭바 ─────────────────────────────────────────────── */

export interface TabItem {
  key: string;
  icon: string;
  label: string;
  onClick?: () => void;
}

export function TabBar({ items, current }: { items: TabItem[]; current: string }) {
  return (
    <nav className="tabbar" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((it) => (
        <button
          key={it.key}
          className="tab"
          aria-current={it.key === current ? "page" : undefined}
          onClick={it.onClick}
        >
          <span className="ico" aria-hidden="true">
            {it.icon}
          </span>
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ── 버튼 ───────────────────────────────────────────────────── */

export function BigButton({
  children,
  onClick,
  tone = "plain",
  disabled,
  type = "button",
  className,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "plain" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      className={`big-btn ${tone}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      disabled={disabled}
      type={type}
      style={style}
    >
      {children}
    </button>
  );
}

/* ── 입력 ───────────────────────────────────────────────────── */

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  inputMode,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  autoFocus?: boolean;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        autoFocus={autoFocus}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Check({
  label,
  checked,
  onChange,
  required,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        <em className={required ? "req" : "opt"}>{required ? "필수" : "선택"}</em>
      </span>
    </label>
  );
}

/* ── 알림 ───────────────────────────────────────────────────── */

/** 상태를 색으로만 알리지 않는다. 아이콘과 문구를 항상 함께 쓴다 (계획서 9장). */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error";
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <p className={`notice ${tone}`} role={tone === "error" ? "alert" : undefined}>
      <span aria-hidden="true">{tone === "error" ? "⚠" : "ℹ"}</span>
      <span>{children}</span>
    </p>
  );
}

export function Spinner({ label = "잠시만 기다려 주세요" }: { label?: string }) {
  return (
    <p className="spinner" role="status">
      {label}
    </p>
  );
}
