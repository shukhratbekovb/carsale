import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- мок env (для секрета HMAC и NODE_ENV) ---
vi.mock('../../config/env.js', () => ({
  env: { NODE_ENV: 'test', OTP_HASH_SECRET: 'test-otp-secret', REDIS_URL: 'redis://x' },
}));

// --- in-memory мок Redis: покрывает подмножество команд OTP-сервиса ---
type Entry = { value: string | Record<string, string>; expireAt?: number };
const store = new Map<string, Entry>();

const now = (): number => Date.now();
const pttl = (key: string): number => {
  const e = store.get(key);
  if (!e) return -2;
  if (e.expireAt === undefined) return -1;
  return Math.max(0, e.expireAt - now());
};
const asHash = (key: string): Record<string, string> => {
  const e = store.get(key);
  if (e && typeof e.value === 'object') return e.value;
  const fresh: Record<string, string> = {};
  store.set(key, { value: fresh });
  return fresh;
};

function makeRedis() {
  const api = {
    async pttl(key: string) {
      return pttl(key);
    },
    async hgetall(key: string) {
      const e = store.get(key);
      return e && typeof e.value === 'object' ? { ...e.value } : {};
    },
    async del(key: string) {
      store.delete(key);
      return 1;
    },
    async set(key: string, value: string, _ex: 'EX', sec: number) {
      store.set(key, { value, expireAt: now() + sec * 1000 });
      return 'OK';
    },
    hset(key: string, obj: Record<string, string | number>) {
      const h = asHash(key);
      for (const [k, v] of Object.entries(obj)) h[k] = String(v);
      return Promise.resolve(Object.keys(obj).length);
    },
    async hincrby(key: string, field: string, by: number) {
      const h = asHash(key);
      const next = Number(h[field] ?? 0) + by;
      h[field] = String(next);
      return next;
    },
    multi() {
      const ops: Array<() => unknown> = [];
      const chain = {
        hset: (key: string, obj: Record<string, string | number>) => {
          ops.push(() => api.hset(key, obj));
          return chain;
        },
        expire: (key: string, sec: number) => {
          ops.push(() => {
            const e = store.get(key);
            if (e) e.expireAt = now() + sec * 1000;
          });
          return chain;
        },
        del: (key: string) => {
          ops.push(() => store.delete(key));
          return chain;
        },
        set: (key: string, value: string, _ex: 'EX', sec: number) => {
          ops.push(() => store.set(key, { value, expireAt: now() + sec * 1000 }));
          return chain;
        },
        exec: async () => {
          for (const op of ops) await op();
          return [];
        },
      };
      return chain;
    },
  };
  return api;
}

vi.mock('../../lib/redis.js', () => ({ getRedis: () => redisMock }));

let redisMock: ReturnType<typeof makeRedis>;

import { AppError } from '../../lib/errors.js';
import { createOtpService, OTP_LOCK_SEC } from './otp-service.js';
import type { SmsGateway } from './sms-gateway.js';

// Шпион-шлюз: запоминает последний отправленный код, чтобы проверить verify
class SpyGateway implements SmsGateway {
  lastCode = '';
  shouldFail = false;
  async sendOtp(_phone: string, code: string): Promise<void> {
    if (this.shouldFail) throw new AppError(503, 'sms_unavailable', 'down');
    this.lastCode = code;
  }
}

const PHONE = '998901234567';

describe('OtpService (BE-1.2)', () => {
  let gateway: SpyGateway;

  beforeEach(() => {
    store.clear();
    redisMock = makeRedis();
    gateway = new SpyGateway();
  });

  it('requestOtp: успех — TTL 300, cooldown выставлен, код 6-значный', async () => {
    const svc = createOtpService(gateway);
    const res = await svc.requestOtp(PHONE);

    expect(res).toEqual({ expiresIn: 300 });
    expect(gateway.lastCode).toMatch(/^\d{6}$/);
    expect(pttl(`otp:cd:${PHONE}`)).toBeGreaterThan(0);
    expect(pttl(`otp:${PHONE}`)).toBeGreaterThan(0);
  });

  it('requestOtp: в пределах cooldown → 429 otp_cooldown с retry_after', async () => {
    const svc = createOtpService(gateway);
    await svc.requestOtp(PHONE);
    await expect(svc.requestOtp(PHONE)).rejects.toMatchObject({
      code: 'otp_cooldown',
      status: 429,
    });
  });

  it('requestOtp: сбой SMS → откат записи, cooldown не выставлен', async () => {
    gateway.shouldFail = true;
    const svc = createOtpService(gateway);
    await expect(svc.requestOtp(PHONE)).rejects.toMatchObject({ code: 'sms_unavailable' });

    expect(store.get(`otp:${PHONE}`)).toBeUndefined();
    expect(pttl(`otp:cd:${PHONE}`)).toBeLessThan(0); // нет ключа
  });

  it('verifyOtp: верный код → успех и запись удалена', async () => {
    const svc = createOtpService(gateway);
    await svc.requestOtp(PHONE);
    await expect(svc.verifyOtp(PHONE, gateway.lastCode)).resolves.toBeUndefined();
    expect(store.get(`otp:${PHONE}`)).toBeUndefined();
  });

  it('verifyOtp: нет записи → otp_expired (400)', async () => {
    const svc = createOtpService(gateway);
    await expect(svc.verifyOtp(PHONE, '000000')).rejects.toMatchObject({
      code: 'otp_expired',
      status: 400,
    });
  });

  it('verifyOtp: неверный код уменьшает attempts_left, 3-я попытка → otp_locked + блок', async () => {
    const svc = createOtpService(gateway);
    await svc.requestOtp(PHONE);
    const wrong = gateway.lastCode === '111111' ? '222222' : '111111';

    await expect(svc.verifyOtp(PHONE, wrong)).rejects.toMatchObject({
      code: 'invalid_otp',
      details: { attempts_left: 2 },
    });
    await expect(svc.verifyOtp(PHONE, wrong)).rejects.toMatchObject({
      code: 'invalid_otp',
      details: { attempts_left: 1 },
    });
    await expect(svc.verifyOtp(PHONE, wrong)).rejects.toMatchObject({
      code: 'otp_locked',
      status: 429,
    });

    // запись OTP удалена, выставлена блокировка ~15 мин
    expect(store.get(`otp:${PHONE}`)).toBeUndefined();
    const lockMs = pttl(`otp:lock:${PHONE}`);
    expect(lockMs).toBeGreaterThan((OTP_LOCK_SEC - 5) * 1000);
  });

  it('verifyOtp: при активной блокировке → 429 otp_locked', async () => {
    const svc = createOtpService(gateway);
    await redisMock.set(`otp:lock:${PHONE}`, '1', 'EX', OTP_LOCK_SEC);
    await expect(svc.verifyOtp(PHONE, '000000')).rejects.toBeInstanceOf(AppError);
    await expect(svc.verifyOtp(PHONE, '000000')).rejects.toMatchObject({ code: 'otp_locked' });
  });
});
