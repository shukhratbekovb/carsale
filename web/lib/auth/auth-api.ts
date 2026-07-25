// Типизированные вызовы auth-эндпоинтов Core через BFF-прокси (§5). Нормализует
// пользователя в SessionUser; ошибки — ApiError с Core-кодами (invalid_otp,
// otp_locked, otp_cooldown, otp_expired, sms_unavailable, account_*).
import { coreFetch } from '@/lib/api/client';
import {
  type CoreMeProfile,
  type CoreVerifyUser,
  fromMeProfile,
  fromVerifyUser,
  type SessionUser,
} from '@/types/session';

export interface VerifyResult {
  accessToken: string;
  user: SessionUser;
}

// POST /auth/otp/send — { expires_in }. Ошибка otp_cooldown при слишком частом запросе.
export async function sendOtp(phone: string): Promise<{ expiresIn: number }> {
  const res = await coreFetch<{ expires_in: number }>('/auth/otp/send', {
    method: 'POST',
    body: { phone },
  });
  return { expiresIn: res.expires_in };
}

// POST /auth/otp/verify — устанавливает refresh cookie (через прокси), отдаёт access + user.
// personalDataConsent обязателен (NFR-20) — фронт всегда шлёт true (форма не пускает false).
export async function verifyOtp(params: {
  phone: string;
  code: string;
  marketingConsent: boolean;
}): Promise<VerifyResult> {
  const res = await coreFetch<{ access_token: string; user: CoreVerifyUser }>('/auth/otp/verify', {
    method: 'POST',
    body: {
      phone: params.phone,
      code: params.code,
      personalDataConsent: true,
      marketingConsent: params.marketingConsent,
    },
  });
  return { accessToken: res.access_token, user: fromVerifyUser(res.user) };
}

// POST /auth/refresh — ротация по httpOnly cookie (без Authorization). 401, если cookie нет.
export async function refreshSession(): Promise<{ accessToken: string }> {
  const res = await coreFetch<{ access_token: string }>('/auth/refresh', { method: 'POST' });
  return { accessToken: res.access_token };
}

// POST /auth/logout — инвалидация refresh + очистка cookie (идемпотентно).
export async function logout(): Promise<void> {
  await coreFetch('/auth/logout', { method: 'POST' });
}

// GET /me — профиль текущего пользователя (для восстановления сессии по cookie).
export async function fetchMe(accessToken: string): Promise<SessionUser> {
  const res = await coreFetch<CoreMeProfile>('/me', { accessToken });
  return fromMeProfile(res);
}
