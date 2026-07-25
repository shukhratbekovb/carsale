import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
}));
const state = vi.hoisted(() => ({ configured: true }));
vi.mock('../../lib/redis.js', () => ({
  isRedisConfigured: () => state.configured,
  getRedis: () => redisMock,
}));

import { getCachedCatalog, invalidateCatalog, setCachedCatalog } from './cache.js';

describe('catalog cache (BE-4.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.configured = true;
    redisMock.get.mockResolvedValue('0'); // версия по умолчанию
  });

  it('get miss → null', async () => {
    redisMock.get.mockImplementation(async (k: string) => (k === 'catalog:ver' ? '0' : null));
    expect(await getCachedCatalog('{"a":1}')).toBeNull();
  });

  it('get hit → распарсенное тело', async () => {
    redisMock.get.mockImplementation(async (k: string) =>
      k === 'catalog:ver' ? '3' : JSON.stringify({ items: [1] }),
    );
    expect(await getCachedCatalog('{"a":1}')).toEqual({ items: [1] });
  });

  it('set → SET с TTL 60с и версионным ключом', async () => {
    redisMock.get.mockResolvedValue('2');
    await setCachedCatalog('{"a":1}', { items: [] });
    const [key, , ex, ttl] = redisMock.set.mock.calls[0] as [string, string, string, number];
    expect(key).toMatch(/^catalog:v2:/);
    expect(ex).toBe('EX');
    expect(ttl).toBe(60);
  });

  it('invalidate → INCR версии', async () => {
    await invalidateCatalog();
    expect(redisMock.incr).toHaveBeenCalledWith('catalog:ver');
  });

  it('без Redis → fail-open (null/no-op, без обращений)', async () => {
    state.configured = false;
    expect(await getCachedCatalog('{"a":1}')).toBeNull();
    await setCachedCatalog('{"a":1}', {});
    await invalidateCatalog();
    expect(redisMock.get).not.toHaveBeenCalled();
    expect(redisMock.incr).not.toHaveBeenCalled();
  });

  it('сбой Redis при get → fail-open (null)', async () => {
    redisMock.get.mockRejectedValue(new Error('redis down'));
    expect(await getCachedCatalog('{"a":1}')).toBeNull();
  });
});
