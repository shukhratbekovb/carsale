// Каноническая форма пользователя сессии на фронте (§5 интеграции). Core отдаёт
// пользователя в двух местах в разных стилях (verify — snake_case, /me —
// camelCase); auth-api нормализует оба в этот единый тип.
export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN';

export interface SessionUser {
  id: string;
  role: UserRole;
  verificationStatus: string;
  email: string | null;
  marketingConsent: boolean;
  createdAt: string;
}

// Ответ Core на verify (snake_case) — то, что реэмитит BFF-прокси.
export interface CoreVerifyUser {
  id: string;
  role: UserRole;
  verification_status: string;
  email: string | null;
  marketing_consent: boolean;
  created_at: string;
}

// Ответ Core на GET /me (camelCase, с масками PII).
export interface CoreMeProfile {
  id: string;
  role: UserRole;
  verificationStatus: string;
  email: string | null;
  createdAt: string;
  consents: { personalData: boolean; marketing: boolean; acceptedAt: string };
}

export function fromVerifyUser(u: CoreVerifyUser): SessionUser {
  return {
    id: u.id,
    role: u.role,
    verificationStatus: u.verification_status,
    email: u.email,
    marketingConsent: u.marketing_consent,
    createdAt: u.created_at,
  };
}

export function fromMeProfile(p: CoreMeProfile): SessionUser {
  return {
    id: p.id,
    role: p.role,
    verificationStatus: p.verificationStatus,
    email: p.email,
    marketingConsent: p.consents.marketing,
    createdAt: p.createdAt,
  };
}
