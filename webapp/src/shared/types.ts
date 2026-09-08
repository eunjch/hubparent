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
