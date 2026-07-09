import type { OtpFlowState } from '@/types/auth';

// Чистые функции перехода состояний для потока «телефон → SMS OTP» (FR-01, UC-03).
// Без побочных эффектов и без чтения Date.now() — время (`now`) всегда передаётся
// снаружи, чтобы поток был детерминированным и легко тестируемым (useReducer в UI
// будет вызывать эти функции, подставляя Date.now() на вызывающей стороне).

export const MAX_OTP_ATTEMPTS = 3;
export const OTP_LOCKOUT_MS = 15 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function createInitialOtpState(): OtpFlowState {
  return {
    phone: null,
    stage: 'PHONE',
    attemptsRemaining: MAX_OTP_ATTEMPTS,
    lockedUntil: null,
    resendAvailableAt: null,
    lastError: null,
  };
}

// Код отправлен (успешно) на указанный номер: сбрасываем попытки и ошибку,
// переходим в CODE_SENT, запускаем cooldown повторной отправки (§9: 60 сек).
export function startOtpRequest(state: OtpFlowState, phone: string, now: number): OtpFlowState {
  return {
    ...state,
    phone,
    stage: 'CODE_SENT',
    attemptsRemaining: MAX_OTP_ATTEMPTS,
    lockedUntil: null,
    resendAvailableAt: now + OTP_RESEND_COOLDOWN_MS,
    lastError: null,
  };
}

// Доступна ли повторная отправка кода прямо сейчас. UI должен проверять это
// перед вызовом resendOtp (например, чтобы отключить кнопку/показать таймер).
export function canResendOtp(state: OtpFlowState, now: number): boolean {
  if (state.stage !== 'CODE_SENT') return false;
  return state.resendAvailableAt == null || now >= state.resendAvailableAt;
}

// Повторная отправка кода. Идемпотентна: если cooldown ещё не истёк, возвращает
// state без изменений (no-op) — UI по-прежнему должен полагаться на canResendOtp
// для управления кнопкой, но сам вызов безопасен в любой момент.
export function resendOtp(state: OtpFlowState, now: number): OtpFlowState {
  if (!canResendOtp(state, now)) return state;
  return {
    ...state,
    attemptsRemaining: MAX_OTP_ATTEMPTS,
    resendAvailableAt: now + OTP_RESEND_COOLDOWN_MS,
    lastError: null,
  };
}

// Неверный код. Расходует одну попытку; при исчерпании попыток — блокировка
// на OTP_LOCKOUT_MS (§9: «3 неверных OTP → блокировка 15 мин с таймером»).
export function submitOtpFailure(state: OtpFlowState, now: number): OtpFlowState {
  const attemptsRemaining = Math.max(0, state.attemptsRemaining - 1);

  if (attemptsRemaining <= 0) {
    return {
      ...state,
      stage: 'LOCKED',
      attemptsRemaining: 0,
      lockedUntil: now + OTP_LOCKOUT_MS,
      lastError: 'INVALID_CODE',
    };
  }

  return {
    ...state,
    attemptsRemaining,
    lastError: 'INVALID_CODE',
  };
}

// true, только пока блокировка ещё действует. Автоматическое снятие блокировки
// по истечении времени — намеренно ответственность UI (вызывающего этот геттер
// на каждый рендер/тик таймера), а не самого reducer-а: reducer не может сам
// себя вызвать при наступлении времени, поэтому здесь только проверка "истекло
// ли уже сейчас", а не мутация state. UI должен реагировать на isLocked() === false
// (например, сбрасывать stage обратно в 'PHONE' или 'CODE_SENT' явным действием).
export function isLocked(state: OtpFlowState, now: number): boolean {
  return state.stage === 'LOCKED' && state.lockedUntil != null && now < state.lockedUntil;
}

// Сбой отправки SMS (Eskiz недоступен, §9). Отдельный от неверного кода случай:
// попытки ввода не расходуются, стадия не меняется.
export function smsUnavailableFailure(state: OtpFlowState): OtpFlowState {
  return {
    ...state,
    lastError: 'SMS_UNAVAILABLE',
  };
}
