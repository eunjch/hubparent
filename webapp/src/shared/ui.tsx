/** 공용 컴포넌트 — MEDIC "01 Warm Care".
 *
 *  계획서 9장의 고령자 UX 기준은 취향이 아니라 수용 기준이다.
 *  본문 18px · 버튼 24px · 터치 56px · 대비 4.5:1 · 색만으로 상태를 구분하지 않음.
 *  값은 tokens.css 에 있고 여기서는 토큰과 클래스만 쓴다.
 */

import type { CSSProperties, ReactNode } from "react";

import { Icon, type IconName } from "./icons";

export type Tone = "meal" | "med" | "mood" | "plan" | "contact" | "warm";

/* ── 화면 뼈대 ──────────────────────────────────────────────── */

export function Screen({
  title,
  onBack,
  children,
  footer,
  tabs,
}: {
  title?: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <div className="screen">
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

/** 홈 상단 — 로고 가운데, 알림 오른쪽. */
export function BrandBar({
  onBell,
  alertCount = 0,
}: {
  onBell?: () => void;
  alertCount?: number;
}) {
  return (
    <div className="brandbar">
      <span className="logo">
        <Icon name="logo" />
        MEDIC
      </span>
      {onBell && (
        <button
          className="bell-btn"
          onClick={onBell}
          aria-label={alertCount > 0 ? `알림 ${alertCount}건` : "알림"}
        >
          <Icon name="bell" />
          {alertCount > 0 && <span className="dot" />}
        </button>
      )}
    </div>
  );
}

/** 이름 + 인사. 시안에서 화면을 여는 가장 큰 글자다. */
export function Greeting({
  name,
  suffix = "님,",
  headline,
  trailingIcon,
  message,
}: {
  name: string;
  suffix?: string;
  headline: string;
  trailingIcon?: IconName;
  message?: string;
}) {
  return (
    <div className="greet">
      <p className="greet-name">
        <span>
          {name}
          {suffix}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {headline}
          {trailingIcon && <Icon name={trailingIcon} />}
        </span>
      </p>
      {message && <p className="greet-sub">{message}</p>}
    </div>
  );
}

/* ── 배너 ───────────────────────────────────────────────────── */

/** 화면 맨 위의 안내 카드. 무엇을 하는 화면인지 한 줄로 알려준다. */
export function Banner({
  icon,
  title,
  description,
  tone = "warm",
  trailingIcon,
}: {
  icon: IconName;
  title: string;
  description?: string;
  tone?: Tone;
  trailingIcon?: IconName;
}) {
  return (
    <div className={`banner ${tone}`}>
      <Icon name={icon} className="lead" />
      <span className="body">
        <span className="t">{title}</span>
        {description && <span className="d">{description}</span>}
      </span>
      {trailingIcon && <Icon name={trailingIcon} className="trail" />}
    </div>
  );
}

/** 화면 맨 아래 응원 문구. 어르신 화면의 마무리 (시안 공통). */
export function Cheer({ icon = "heart", children }: { icon?: IconName; children: ReactNode }) {
  return (
    <div className="cheer">
      <Icon name={icon} />
      <p>{children}</p>
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

/* ── 홈 타일 ───────────────────────────────────────────────── */

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="tile-grid">{children}</div>;
}

export function Tile({
  icon,
  label,
  description,
  tone,
  onClick,
}: {
  icon: IconName;
  label: string;
  /** 시안의 "오늘 식사 기록하기 ›" 같은 한 줄 안내 */
  description?: string;
  tone: Tone;
  onClick?: () => void;
}) {
  return (
    <button className={`tile ${tone}`} onClick={onClick}>
      <span className="head">
        <Icon name={icon} />
        <span className="t">{label}</span>
      </span>
      {description && (
        <span className="d">
          {description} <span aria-hidden="true">›</span>
        </span>
      )}
    </button>
  );
}

/* ── 목록 행 ───────────────────────────────────────────────── */

export type PillTone = "todo" | "done" | "good" | "mid" | "none";

/** 상태 알약. 색만으로 알리지 않도록 문구를 반드시 함께 쓴다 (계획서 9장). */
export function StatusPill({
  tone,
  children,
  withCheck,
}: {
  tone: PillTone;
  children: ReactNode;
  withCheck?: boolean;
}) {
  return (
    <span className={`pill ${tone}`}>
      {withCheck && <Icon name="yes" size={16} />}
      {children}
    </span>
  );
}

export function RowCard({
  icon,
  title,
  description,
  right,
  onClick,
  chevron,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  right?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const inner = (
    <>
      {icon && <Icon name={icon} className="lead" />}
      <span className="body">
        <span className="t">{title}</span>
        {description && <span className="d">{description}</span>}
      </span>
      {right}
      {chevron && (
        <span className="chev" aria-hidden="true">
          ›
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button className="row-card" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className="row-card">{inner}</div>;
}

/** 세그먼트 탭 — 알림 필터 · 약 복용 관리 · 일정 확인에 공통으로 쓴다 (시안).
 *  활성 항목은 색만이 아니라 채움으로도 구분된다 (계획서 9장). */
export function SegTabs<T extends string>({
  items,
  current,
  onChange,
  className,
}: {
  items: { key: T; label: string }[];
  current: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div className={`seg${className ? ` ${className}` : ""}`} role="tablist">
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          className={`seg-item${it.key === current ? " on" : ""}`}
          aria-selected={it.key === current}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** 건강 지수. 링을 CSS 로 그려 숫자가 항상 실제 값이다.
 *  숫자와 문구를 함께 쓴다 — 색·각도만으로 알리지 않는다 (계획서 9장). */
export function ScoreRing({
  score,
  size = "lg",
}: {
  score: number;
  size?: "lg" | "sm";
}) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <span
      className={`score-ring ${size}`}
      style={{ ["--pct" as string]: `${clamped}%` }}
      role="img"
      aria-label={`건강 지수 ${clamped}점`}
    >
      <span className="value">{clamped}</span>
    </span>
  );
}

/* ── 하단 탭바 ─────────────────────────────────────────────── */

export interface TabItem {
  key: string;
  icon: IconName;
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
          <Icon name={it.icon} />
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
  icon,
  disabled,
  type = "button",
  className,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "plain" | "confirm" | "soft" | "danger";
  icon?: IconName;
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
      {icon && <Icon name={icon} />}
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
      <Icon name={tone === "error" ? "alert" : "leaf"} />
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
