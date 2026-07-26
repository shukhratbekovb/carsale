import { afterEach, describe, expect, it, vi } from 'vitest';

const authed = vi.hoisted(() => ({ authorizedFetch: vi.fn() }));
vi.mock('@/lib/auth/authorized-fetch', () => ({ authorizedFetch: authed.authorizedFetch }));

import { fetchMyListings } from './my-listings-api';

afterEach(() => vi.clearAllMocks());

describe('fetchMyListings (§5)', () => {
  it('идёт через authorizedFetch на /my/listings и разворачивает items', async () => {
    authed.authorizedFetch.mockResolvedValue({
      items: [{ id: 'l1', status: 'PUBLISHED', make: 'Chevrolet' }],
    });
    const res = await fetchMyListings();
    expect(authed.authorizedFetch).toHaveBeenCalledWith('/my/listings');
    expect(res).toEqual([{ id: 'l1', status: 'PUBLISHED', make: 'Chevrolet' }]);
  });

  it('пробрасывает ошибку (401 после провала refresh и т.п.)', async () => {
    authed.authorizedFetch.mockRejectedValue(new Error('unauthorized'));
    await expect(fetchMyListings()).rejects.toThrow('unauthorized');
  });
});
