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

export interface FamilyCreated {
  family: { id: string; name: string };
  senior_id: string;
  invitation_code: string;
  invitation_expires_at: string;
}

export interface InvitationPreview {
  family_name: string;
  target_name: string;
  expired: boolean;
  used: boolean;
}
