import { z } from 'zod';

// Контракт совпадает с web/lib/validation/auth.ts: UZ-номер +998 и 9 цифр,
// код — ровно 6 цифр, согласия NFR-20 (обязательное ПД + опциональный маркетинг).
const UZ_PHONE = /^\+998\d{9}$/;

export const sendOtpSchema = z.object({
  phone: z.string().trim().regex(UZ_PHONE, 'Invalid Uzbekistan phone number'),
});

export const verifyOtpSchema = z.object({
  phone: z.string().trim().regex(UZ_PHONE, 'Invalid Uzbekistan phone number'),
  code: z.string().trim().regex(/^\d{6}$/, 'OTP code must be 6 digits'),
  // Фронт всегда шлёт согласие ПД при входе/регистрации (login-форма, NFR-20)
  personalDataConsent: z.literal(true),
  marketingConsent: z.boolean().default(false),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
