import { describe, expect, it, vi } from 'vitest';
import { AppError } from './errors.js';

const envState = vi.hoisted(() => ({
  state: { NODE_ENV: 'test', REDIS_URL: undefined as string | undefined },
}));

vi.mock('../config/env.js', () => ({ env: envState.state }));

vi.mock('ioredis', () => {
  class MockRedis {
    constructor(
      readonly url: string,
      readonly options: object,
    ) {}
    on(): this {
      return this;
    }
  }
  return { Redis: MockRedis, default: MockRedis };
});

import { getRedis, isRedisConfigured } from './redis.js';

describe('redis wrapper (BE-0.8)', () => {
  it('без REDIS_URL — внятная стартовая ошибка, а не падение в рантайме', () => {
    envState.state.REDIS_URL = undefined;
    expect(isRedisConfigured()).toBe(false);
    try {
      getRedis();
      expect.unreachable('getRedis должен бросить');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('redis_not_configured');
      expect((err as AppError).status).toBe(503);
    }
  });

  it('с REDIS_URL — ленивый синглтон (одна инстанция на процесс)', () => {
    envState.state.REDIS_URL = 'redis://localhost:6379';
    expect(isRedisConfigured()).toBe(true);
    const a = getRedis();
    const b = getRedis();
    expect(a).toBe(b);
  });
});
