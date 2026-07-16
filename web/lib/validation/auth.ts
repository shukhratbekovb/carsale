import { z } from 'zod';
import type { ValidationTranslator } from '@/lib/validation/translator';

// Узбекский мобильный номер в международном формате: +998 и 9 цифр после кода
// страны, например +998901234567 (итого 13 символов вместе с «+»).
const UZ_PHONE_REGEX = /^\+998\d{9}$/;

export function createPhoneSchema(t: ValidationTranslator) {
  return z.string().trim().regex(UZ_PHONE_REGEX, t('phoneFormat'));
}

// Длина OTP-кода фиксирована на 6 цифр — допущение для рынка UZ (совпадает с
// типовой длиной кодов Eskiz/большинства SMS-провайдеров); поменять при
// подключении реального Core API, если бэкенд пришлёт другую длину.
export const OTP_CODE_LENGTH = 6;

export function createOtpCodeSchema(t: ValidationTranslator) {
  return z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), t('otpCode', { length: OTP_CODE_LENGTH }));
}

// Согласия при регистрации (FE-9, ЗРУ-547): базовое согласие на обработку ПД
// обязательно (z.literal(true) — чекбокс нельзя оставить снятым), маркетинговое
// — опциональный boolean, отзываемый позже через настройки профиля (PRD 7.2).
export function createRegistrationConsentSchema(t: ValidationTranslator) {
  return z.object({
    personalDataConsent: z.literal(true, t('personalDataConsentRequired')),
    marketingConsent: z.boolean(),
  });
}

export type PhoneInput = z.infer<ReturnType<typeof createPhoneSchema>>;
export type OtpCodeInput = z.infer<ReturnType<typeof createOtpCodeSchema>>;
export type RegistrationConsentInput = z.infer<ReturnType<typeof createRegistrationConsentSchema>>;
