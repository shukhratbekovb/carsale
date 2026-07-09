import { describe, expect, test } from 'vitest';
import {
  MAX_OTP_ATTEMPTS,
  OTP_LOCKOUT_MS,
  OTP_RESEND_COOLDOWN_MS,
  canResendOtp,
  createInitialOtpState,
  isLocked,
  resendOtp,
  smsUnavailableFailure,
  startOtpRequest,
  submitOtpFailure,
} from './otp-flow';

const NOW = 1_000_000;
const PHONE = '+998901234567';

describe('createInitialOtpState', () => {
  test('starts in PHONE stage with no phone/lockout', () => {
    const state = createInitialOtpState();
    expect(state.stage).toBe('PHONE');
    expect(state.phone).toBeNull();
    expect(state.lockedUntil).toBeNull();
    expect(state.resendAvailableAt).toBeNull();
    expect(state.attemptsRemaining).toBe(MAX_OTP_ATTEMPTS);
    expect(state.lastError).toBeNull();
  });
});

describe('startOtpRequest', () => {
  test('moves to CODE_SENT, sets phone, resets attempts, sets resend cooldown', () => {
    const state = startOtpRequest(createInitialOtpState(), PHONE, NOW);
    expect(state.stage).toBe('CODE_SENT');
    expect(state.phone).toBe(PHONE);
    expect(state.attemptsRemaining).toBe(MAX_OTP_ATTEMPTS);
    expect(state.resendAvailableAt).toBe(NOW + OTP_RESEND_COOLDOWN_MS);
    expect(state.lockedUntil).toBeNull();
    expect(state.lastError).toBeNull();
  });
});

describe('canResendOtp', () => {
  test('is false immediately after startOtpRequest', () => {
    const state = startOtpRequest(createInitialOtpState(), PHONE, NOW);
    expect(canResendOtp(state, NOW)).toBe(false);
  });

  test('is true once now >= resendAvailableAt', () => {
    const state = startOtpRequest(createInitialOtpState(), PHONE, NOW);
    expect(canResendOtp(state, NOW + OTP_RESEND_COOLDOWN_MS)).toBe(true);
    expect(canResendOtp(state, NOW + OTP_RESEND_COOLDOWN_MS + 1)).toBe(true);
  });
});

describe('resendOtp', () => {
  test('is a no-op before the cooldown elapses', () => {
    const state = startOtpRequest(createInitialOtpState(), PHONE, NOW);
    const result = resendOtp(state, NOW + 1);
    expect(result).toEqual(state);
    expect(result.resendAvailableAt).toBe(state.resendAvailableAt);
  });

  test('resets the cooldown once it has elapsed', () => {
    const state = startOtpRequest(createInitialOtpState(), PHONE, NOW);
    const laterNow = NOW + OTP_RESEND_COOLDOWN_MS;
    const result = resendOtp(state, laterNow);
    expect(result.resendAvailableAt).toBe(laterNow + OTP_RESEND_COOLDOWN_MS);
    expect(result.attemptsRemaining).toBe(MAX_OTP_ATTEMPTS);
    expect(result.lastError).toBeNull();
  });
});

describe('submitOtpFailure', () => {
  test('decrements attemptsRemaining and sets lastError while attempts remain', () => {
    const state = startOtpRequest(createInitialOtpState(), PHONE, NOW);
    const result = submitOtpFailure(state, NOW);
    expect(result.attemptsRemaining).toBe(MAX_OTP_ATTEMPTS - 1);
    expect(result.lastError).toBe('INVALID_CODE');
    expect(result.stage).toBe('CODE_SENT');
  });

  test('locks the flow after MAX_OTP_ATTEMPTS failures', () => {
    let state = startOtpRequest(createInitialOtpState(), PHONE, NOW);
    let now = NOW;
    for (let i = 0; i < MAX_OTP_ATTEMPTS; i += 1) {
      now += 1000;
      state = submitOtpFailure(state, now);
    }
    expect(state.stage).toBe('LOCKED');
    expect(state.attemptsRemaining).toBe(0);
    expect(state.lockedUntil).toBe(now + OTP_LOCKOUT_MS);
    expect(state.lastError).toBe('INVALID_CODE');
  });
});

describe('isLocked', () => {
  test('is true while stage is LOCKED and lockedUntil is in the future', () => {
    let state = startOtpRequest(createInitialOtpState(), PHONE, NOW);
    for (let i = 0; i < MAX_OTP_ATTEMPTS; i += 1) {
      state = submitOtpFailure(state, NOW);
    }
    expect(isLocked(state, NOW)).toBe(true);
    expect(isLocked(state, (state.lockedUntil as number) - 1)).toBe(true);
  });

  test('is false once now >= lockedUntil, without mutating state', () => {
    let state = startOtpRequest(createInitialOtpState(), PHONE, NOW);
    for (let i = 0; i < MAX_OTP_ATTEMPTS; i += 1) {
      state = submitOtpFailure(state, NOW);
    }
    const lockedUntil = state.lockedUntil as number;
    expect(isLocked(state, lockedUntil)).toBe(false);
    // The reducer itself does not auto-unlock; stage stays LOCKED.
    expect(state.stage).toBe('LOCKED');
  });
});

describe('smsUnavailableFailure', () => {
  test('sets lastError to SMS_UNAVAILABLE without touching attemptsRemaining', () => {
    const state = startOtpRequest(createInitialOtpState(), PHONE, NOW);
    const result = smsUnavailableFailure(state);
    expect(result.lastError).toBe('SMS_UNAVAILABLE');
    expect(result.attemptsRemaining).toBe(state.attemptsRemaining);
    expect(result.stage).toBe(state.stage);
  });
});
