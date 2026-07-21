import { describe, expect, it } from 'vitest';
import { AppError } from './errors.js';
import { hashPhone, normalizePhone } from './phone.js';

describe('normalizePhone (BE-1.6)', () => {
  it('приводит различные валидные формы к каноническому 998XXXXXXXXX', () => {
    const canonical = '998901234567';
    expect(normalizePhone('+998901234567')).toBe(canonical);
    expect(normalizePhone('998901234567')).toBe(canonical);
    expect(normalizePhone('+998 90 123 45 67')).toBe(canonical);
    expect(normalizePhone('+998-90-123-45-67')).toBe(canonical);
    expect(normalizePhone('+998 (90) 123-45-67')).toBe(canonical);
  });

  it('отклоняет некорректные номера с AppError invalid_phone (400)', () => {
    for (const bad of ['', '12345', '+7 900 000 00 00', '99890123456', '9989012345678', 'abc']) {
      expect(() => normalizePhone(bad)).toThrowError(AppError);
      try {
        normalizePhone(bad);
      } catch (err) {
        expect((err as AppError).code).toBe('invalid_phone');
        expect((err as AppError).status).toBe(400);
      }
    }
  });
});

describe('hashPhone (BE-1.6, NFR-15)', () => {
  it('детерминирован: один номер → один хеш', () => {
    expect(hashPhone('998901234567')).toBe(hashPhone('998901234567'));
  });

  it('разные номера → разные хеши, результат не содержит сырой номер', () => {
    const a = hashPhone('998901234567');
    const b = hashPhone('998907654321');
    expect(a).not.toBe(b);
    expect(a).not.toContain('998901234567');
    expect(a).toMatch(/^[0-9a-f]{64}$/); // hex sha256
  });
});
