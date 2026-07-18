import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './error-handler.js';
import { rateLimit, type RateLimitOptions } from './rate-limit.js';

// --- моки: env (мутабельный), logger (шпион), ioredis (in-memory счётчики) ---

const envState = vi.hoisted(() => ({
  state: { NODE_ENV: 'test', REDIS_URL: 'redis://localhost:6379' } as {
    NODE_ENV: string;
    REDIS_URL: string | undefined;
  },
}));

vi.mock('../config/env.js', () => ({ env: envState.state }));

vi.mock('../lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const redisState = vi.hoisted(() => ({ counts: new Map<string, number>() }));

vi.mock('ioredis', () => {
  class MockRedis {
    on(): this {
      return this;
    }
    multi() {
      const ops: Array<() => unknown> = [];
      const chain = {
        incr: (key: string) => {
          ops.push(() => {
            const next = (redisState.counts.get(key) ?? 0) + 1;
            redisState.counts.set(key, next);
            return next;
          });
          return chain;
        },
        pexpire: () => {
          ops.push(() => 1);
          return chain;
        },
        exec: async () => ops.map((op) => [null, op()] as [null, unknown]),
      };
      return chain;
    }
  }
  return { Redis: MockRedis, default: MockRedis };
});

import { logger } from '../lib/logger.js';

function buildApp(opts: RateLimitOptions): express.Express {
  const app = express();
  app.get('/ping', rateLimit(opts), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('rateLimit middleware (BE-0.7 / NFR-14)', () => {
  beforeEach(() => {
    redisState.counts.clear();
    envState.state.REDIS_URL = 'redis://localhost:6379';
    vi.clearAllMocks();
  });

  it('пропускает запросы в пределах лимита', async () => {
    const app = buildApp({ max: 3, prefix: 'under' });
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
    }
  });

  it('сверх лимита — 429 с формой { error, code, details.retry_after } и Retry-After', async () => {
    const app = buildApp({ max: 2, prefix: 'over' });
    await request(app).get('/ping');
    await request(app).get('/ping');
    const res = await request(app).get('/ping');

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('rate_limited');
    expect(res.body.error).toBeTruthy();
    expect(res.body.details.retry_after).toBeGreaterThanOrEqual(1);
    expect(res.headers['retry-after']).toBe(String(res.body.details.retry_after));
  });

  it('keyFn подключаем: лимит считается по субъекту из keyFn, не по IP', async () => {
    const app = buildApp({ max: 1, prefix: 'user', keyFn: (req) => String(req.query.u) });
    expect((await request(app).get('/ping?u=alice')).status).toBe(200);
    expect((await request(app).get('/ping?u=bob')).status).toBe(200);
    expect((await request(app).get('/ping?u=alice')).status).toBe(429);
  });

  it('без REDIS_URL — fail-open с единственным warn-логом', async () => {
    envState.state.REDIS_URL = undefined;
    const app = buildApp({ max: 1, prefix: 'noredis' });

    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
