import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MOCK_OTP_CODE, mockSendOtp, mockVerifyOtp } from './otp';

const PHONE = '+998901234567';

describe('mockSendOtp / mockVerifyOtp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('mockSendOtp resolves { ok: true }', async () => {
    const promise = mockSendOtp(PHONE);
    await vi.advanceTimersByTimeAsync(800);
    await expect(promise).resolves.toEqual({ ok: true });
  });

  test('mockVerifyOtp resolves true for the correct mock code', async () => {
    const promise = mockVerifyOtp(PHONE, MOCK_OTP_CODE);
    await vi.advanceTimersByTimeAsync(800);
    await expect(promise).resolves.toBe(true);
  });

  test('mockVerifyOtp resolves false for an incorrect code', async () => {
    const promise = mockVerifyOtp(PHONE, 'wrong-code');
    await vi.advanceTimersByTimeAsync(800);
    await expect(promise).resolves.toBe(false);
  });
});
