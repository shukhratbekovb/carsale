import { type CookieOptions, Router } from 'express';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { AppError } from '../../lib/errors.js';
import { REFRESH_TTL_SEC } from '../../lib/jwt.js';
import { getAuthService } from './service.js';
import { sendOtpSchema, verifyOtpSchema } from './validation.js';

/**
 * Auth-роуты (BE-1.3, §6.1). Ответы — snake_case по контракту диаграмм.
 * Refresh хранится в httpOnly cookie (09-architecture §5), access — в теле.
 */

const REFRESH_COOKIE = 'refresh_token';

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TTL_SEC * 1000,
  };
}

export const authRouter = Router();

// Отправка OTP. 429 otp_cooldown при слишком частом повторе (OTP-сервис).
authRouter.post(
  '/otp/send',
  asyncHandler(async (req, res) => {
    const { phone } = sendOtpSchema.parse(req.body);
    const { expiresIn } = await getAuthService().requestOtp(phone);
    res.json({ expires_in: expiresIn });
  }),
);

// Проверка OTP → upsert пользователя → выдача пары токенов. 201 для нового.
authRouter.post(
  '/otp/verify',
  asyncHandler(async (req, res) => {
    const input = verifyOtpSchema.parse(req.body);
    const { user, accessToken, refreshToken, isNew } = await getAuthService().verify(input);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.status(isNew ? 201 : 200).json({ access_token: accessToken, user });
  }),
);

// Ротация refresh → новый access + новый refresh cookie.
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!token) throw new AppError(401, 'no_refresh_token', 'Missing refresh token');
    const { accessToken, refreshToken } = await getAuthService().refresh(token);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.json({ access_token: accessToken });
  }),
);

// Инвалидация refresh + очистка cookie (идемпотентно).
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (token) await getAuthService().logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    res.status(204).end();
  }),
);
