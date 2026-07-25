import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { authorizedFetch } from './authorized-fetch';

// Мокаем coreFetch (сеть) и token-store (токен + refresh), сохраняя реальный ApiError.
vi.mock('@/lib/api/client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api/client')>();
  return { ...actual, coreFetch: vi.fn() };
});
vi.mock('@/lib/auth/token-store', () => ({
  getAccessToken: vi.fn(() => 'old-token'),
  refreshAccessToken: vi.fn(),
}));

import { coreFetch } from '@/lib/api/client';
import { getAccessToken, refreshAccessToken } from '@/lib/auth/token-store';

const coreFetchMock = vi.mocked(coreFetch);
const refreshMock = vi.mocked(refreshAccessToken);
const getTokenMock = vi.mocked(getAccessToken);

afterEach(() => vi.clearAllMocks());

describe('authorizedFetch (§5, авто-refresh на 401)', () => {
  it('успех с первой попытки — прикрепляет текущий токен, без refresh', async () => {
    getTokenMock.mockReturnValue('old-token');
    coreFetchMock.mockResolvedValueOnce({ ok: 1 });
    await expect(authorizedFetch('/me')).resolves.toEqual({ ok: 1 });
    expect(coreFetchMock).toHaveBeenCalledWith('/me', expect.objectContaining({ accessToken: 'old-token' }));
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('401 → refresh → повтор с новым токеном', async () => {
    coreFetchMock
      .mockRejectedValueOnce(new ApiError(401, 'unauthorized', 'expired'))
      .mockResolvedValueOnce({ ok: 2 });
    refreshMock.mockResolvedValue('new-token');

    await expect(authorizedFetch('/me')).resolves.toEqual({ ok: 2 });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(coreFetchMock).toHaveBeenCalledTimes(2);
    expect(coreFetchMock.mock.calls[1][1]).toMatchObject({ accessToken: 'new-token' });
  });

  it('401 → refresh не удался (null) → пробрасывает исходную 401, без повтора', async () => {
    coreFetchMock.mockRejectedValueOnce(new ApiError(401, 'unauthorized', 'expired'));
    refreshMock.mockResolvedValue(null);

    await expect(authorizedFetch('/me')).rejects.toMatchObject({ status: 401 });
    expect(coreFetchMock).toHaveBeenCalledTimes(1);
  });

  it('не-401 ошибка → проброс без refresh', async () => {
    coreFetchMock.mockRejectedValueOnce(new ApiError(403, 'forbidden', 'no'));
    await expect(authorizedFetch('/me')).rejects.toMatchObject({ status: 403 });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
