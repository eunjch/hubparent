/** 서버 응답 타입. backend/app/schemas 와 짝을 이룬다. */

export type Role = "senior" | "guardian";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  is_new_user: boolean;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  role: Role;
  birth_year: number | null;
}

export interface Me {
  user: User;
  family_id: string | null;
  family_name: string | null;
  consented: boolean;
}

/** 자녀가 관리하는 부모님 한 명 */
export interface Senior {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
  birth_year: number | null;
  /** 한 번이라도 앱에 들어온 적이 있는지 */
  joined: boolean;
}

/** 부모 로그인 1단계 결과 — 이름 외의 정보는 오지 않는다 */
export interface SeniorChoice {
  id: string;
  name: string;
  relation: string | null;
}

export interface SeniorLookupResult {
  family_name: string;
  guardian_name: string;
  seniors: SeniorChoice[];
}

/* ── 체크 3종 (화면 S2 · S3 · S4) ───────────────────────── */

export type CheckSlot = "breakfast" | "lunch" | "dinner";
export type MealStatus = "ate" | "skipped";
export type MoodValue = "good" | "normal" | "bad";
export type MedicationStatus = "pending" | "taken" | "missed";

export interface MealCheck {
  id: string;
  check_date: string;
  slot: CheckSlot;
  status: MealStatus;
  photo_path: string | null;
  checked_at?: string;
}

export interface MoodCheck {
  id: string;
  check_date: string;
  slot: CheckSlot;
  mood: MoodValue;
  checked_at?: string;
}

/** 자녀가 등록한 약 (화면 G4) */
export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dose: string | null;
  times: string[];
  weekdays: number[];
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

/** 오늘 먹어야 할 한 건 (화면 S3) */
export interface Dose {
  medication_id: string;
  name: string;
  dose: string | null;
  /** "08:00" — 화면에 그대로 쓴다 */
  time: string;
  /** 응답을 올릴 때 그대로 돌려보낸다 */
  scheduled_at: string;
  status: MedicationStatus;
}

/* ── 일정 (화면 G3 · S5) ────────────────────────────────── */

export type ScheduleKind = "hospital" | "dental" | "checkup" | "family" | "other";

export interface Schedule {
  id: string;
  target_user_id: string;
  title: string;
  kind: ScheduleKind;
  start_at: string;
  place: string | null;
  /** [1440, 60] 이면 하루 전 + 1시간 전 */
  reminder_minutes: number[];
  notified_at: string | null;
  upcoming: boolean;
}
