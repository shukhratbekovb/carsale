import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/auth-api', () => ({ refreshSession: vi.fn() }));

import { refreshSession } from '@/lib/auth/auth-api';
import {
  getAccessToken,
  refreshAccessToken,
  registerSessionHooks,
  setAccessToken,
} from './token-store';

const refreshMock = vi.mocked(refreshSession);

beforeEach(() => {
  setAccessToken(null);
  registerSessionHooks({});
  refreshMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('token-store (§5)', () => {
  it('set/get access token', () => {
    setAccessToken('t1');
    expect(getAccessToken()).toBe('t1');
  });

  it('refreshAccessToken дедуплицирует параллельные вызовы в один сетевой refresh', async () => {
    let resolve!: (v: { accessToken: string }) => void;
    refreshMock.mockReturnValue(new Promise((r) => (resolve = r)));

    const a = refreshAccessToken();
    const b = refreshAccessToken();
    resolve({ accessToken: 'fresh' });
    const [ra, rb] = await Promise.all([a, b]);

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(ra).toBe('fresh');
    expect(rb).toBe('fresh');
    expect(getAccessToken()).toBe('fresh');
  });

  it('успех вызывает onRefreshed с новым токеном', async () => {
    const onRefreshed = vi.fn();
    registerSessionHooks({ onRefreshed });
    refreshMock.mockResolvedValue({ accessToken: 'fresh' });

    await refreshAccessToken();
    expect(onRefreshed).toHaveBeenCalledWith('fresh');
  });

  it('провал refresh → null, токен сброшен, onAuthLost вызван', async () => {
    const onAuthLost = vi.fn();
    registerSessionHooks({ onAuthLost });
    setAccessToken('stale');
    refreshMock.mockRejectedValue(new Error('no cookie'));

    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });
});
