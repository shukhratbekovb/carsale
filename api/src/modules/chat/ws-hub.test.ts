import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'test', JWT_SECRET: 'test-jwt-secret' } }));

import { signAccessToken } from '../../lib/jwt.js';
import { authenticateSocketToken } from './ws-hub.js';

describe('authenticateSocketToken (BE-5.2)', () => {
  it('валидный access-токен → userId', () => {
    const token = signAccessToken('user-1', 'BUYER');
    expect(authenticateSocketToken(token)).toBe('user-1');
  });

  it('отсутствующий/пустой токен → ошибка', () => {
    expect(() => authenticateSocketToken(undefined)).toThrow();
    expect(() => authenticateSocketToken('')).toThrow();
    expect(() => authenticateSocketToken(123)).toThrow();
  });

  it('битый токен → ошибка (не пропускаем handshake)', () => {
    expect(() => authenticateSocketToken('garbage')).toThrow();
  });
});
