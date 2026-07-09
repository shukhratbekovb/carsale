import { z } from 'zod';

// Узбекский мобильный номер в международном формате: +998 и 9 цифр после кода
// страны, например +998901234567 (итого 13 символов вместе с «+»).
const UZ_PHONE_REGEX = /^\+998\d{9}$/;

export const phoneSchema = z
  .string()
  .trim()
  .regex(UZ_PHONE_REGEX, 'Введите номер в формате +998901234567');

// Длина OTP-кода фиксирована на 6 цифр — допущение для рынка UZ (совпадает с
// типовой длиной кодов Eskiz/большинства SMS-провайдеров); поменять при
// подключении реального Core API, если бэкенд пришлёт другую длину.
const OTP_CODE_LENGTH = 6;

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), `Введите код из ${OTP_CODE_LENGTH} цифр`);

export type PhoneInput = z.infer<typeof phoneSchema>;
export type OtpCodeInput = z.infer<typeof otpCodeSchema>;
