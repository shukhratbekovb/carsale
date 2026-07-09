import { describe, expect, test } from 'vitest';
import { otpCodeSchema, phoneSchema } from './auth';

describe('phoneSchema', () => {
  test('accepts a valid Uzbekistan number', () => {
    expect(phoneSchema.safeParse('+998901234567').success).toBe(true);
  });

  test('rejects a number missing the +998 prefix', () => {
    expect(phoneSchema.safeParse('901234567').success).toBe(false);
  });

  test('rejects a number with the wrong digit count', () => {
    expect(phoneSchema.safeParse('+99890123456').success).toBe(false);
    expect(phoneSchema.safeParse('+9989012345678').success).toBe(false);
  });

  test('rejects non-digit characters', () => {
    expect(phoneSchema.safeParse('+998901abcdef').success).toBe(false);
  });

  test('rejects an empty string', () => {
    expect(phoneSchema.safeParse('').success).toBe(false);
  });
});

describe('otpCodeSchema', () => {
  test('accepts a 6-digit numeric string', () => {
    expect(otpCodeSchema.safeParse('123456').success).toBe(true);
  });

  test('rejects the wrong length', () => {
    expect(otpCodeSchema.safeParse('12345').success).toBe(false);
    expect(otpCodeSchema.safeParse('1234567').success).toBe(false);
  });

  test('rejects non-digit characters', () => {
    expect(otpCodeSchema.safeParse('12a456').success).toBe(false);
  });

  test('rejects an empty string', () => {
    expect(otpCodeSchema.safeParse('').success).toBe(false);
  });
});
