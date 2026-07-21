import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: { NODE_ENV: 'test', JWT_SECRET: 'test-jwt-secret' },
}));

// in-memory Redis (get/set/del) для allowlist refresh-токенов
const store = new Map<string, string>();
vi.mock('./redis.js', () => ({
  getRedis: () => ({
    async set(key: string, value: string) {
      store.set(key, value);
      return 'OK';
    },
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0;
    },
  }),
}));

import { AppError } from './errors.js';
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from './jwt.js';

describe('access token (BE-1.4)', () => {
  it('sign → verify round-trip несёт sub и role', () => {
    const token = signAccessToken('user-1', 'SELLER');
    expect(verifyAccessToken(token)).toEqual({ sub: 'user-1', role: 'SELLER' });
  });

  it('битый токен → 401 invalid_token', () => {
    expect(() => verifyAccessToken('garbage')).toThrowError(AppError);
    try {
      verifyAccessToken('garbage');
    } catch (err) {
      expect((err as AppError).status).toBe(401);
      expect((err as AppError).code).toBe('invalid_token');
    }
  });

  it('refresh-токен не принимается как access', async () => {
    const refresh = await issueRefreshToken('user-1');
    expect(() => verifyAccessToken(refresh)).toThrowError(/Not an access token|invalid/);
  });
});

describe('refresh token (BE-1.4)', () => {
  beforeEach(() => store.clear());

  it('ротация выдаёт новый refresh и инвалидирует старый (одноразовость)', async () => {
    const first = await issueRefreshToken('user-1');
    const { userId, refreshToken: second } = await rotateRefreshToken(first);

    expect(userId).toBe('user-1');
    expect(second).not.toBe(first);
    // повторное использование старого → 401 token_revoked
    await expect(rotateRefreshToken(first)).rejects.toMatchObject({ code: 'token_revoked' });
  });

  it('logout инвалидирует refresh', async () => {
    const token = await issueRefreshToken('user-1');
    await revokeRefreshToken(token);
    await expect(rotateRefreshToken(token)).rejects.toMatchObject({ code: 'token_revoked' });
  });

  it('logout идемпотентен для битого токена', async () => {
    await expect(revokeRefreshToken('garbage')).resolves.toBeUndefined();
  });
});
