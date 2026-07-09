// Типы для потока входа по номеру телефона + SMS OTP (FR-01, UC-03).
// Пока нет реального Core API — состояние ведёт useReducer на клиенте (FE-2),
// поэтому объект должен оставаться plain/serializable: без функций и классов.

// PHONE — ввод номера. CODE_SENT — код отправлен, ждём ввода. LOCKED — превышено
// число попыток, действует таймаут (см. OTP_LOCKOUT_MS в lib/auth/otp-flow.ts).
export type OtpStage = 'PHONE' | 'CODE_SENT' | 'LOCKED';

// SMS_UNAVAILABLE — сбой отправки через Eskiz (§9 плана), отдельный случай от
// неверного кода: не расходует попытки ввода.
export type OtpErrorKind = 'INVALID_CODE' | 'SMS_UNAVAILABLE' | null;

export interface OtpFlowState {
  phone: string | null;
  stage: OtpStage;
  // Сколько попыток ввода кода осталось. Сбрасывается на MAX_OTP_ATTEMPTS при
  // каждой успешной отправке кода (startOtpRequest).
  attemptsRemaining: number;
  // Timestamp (мс, как Date.now()), до которого действует блокировка. null, если
  // блокировки нет/ещё не наступала.
  lockedUntil: number | null;
  // Timestamp (мс), начиная с которого повторная отправка кода снова разрешена.
  // null до первой отправки.
  resendAvailableAt: number | null;
  lastError: OtpErrorKind;
}
