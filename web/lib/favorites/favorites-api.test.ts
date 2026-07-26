import { afterEach, describe, expect, it, vi } from 'vitest';

const authed = vi.hoisted(() => ({ authorizedFetch: vi.fn() }));
vi.mock('@/lib/auth/authorized-fetch', () => ({ authorizedFetch: authed.authorizedFetch }));

import { addFavorite, fetchFavoriteIds, fetchFavorites, removeFavorite } from './favorites-api';

afterEach(() => vi.clearAllMocks());

describe('favorites-api (§5)', () => {
  it('fetchFavoriteIds → /favorites/ids, разворачивает ids', async () => {
    authed.authorizedFetch.mockResolvedValue({ ids: ['a', 'b'] });
    await expect(fetchFavoriteIds()).resolves.toEqual(['a', 'b']);
    expect(authed.authorizedFetch).toHaveBeenCalledWith('/favorites/ids');
  });

  it('fetchFavorites → /favorites, разворачивает items', async () => {
    authed.authorizedFetch.mockResolvedValue({ items: [{ id: 'l1' }] });
    await expect(fetchFavorites()).resolves.toEqual([{ id: 'l1' }]);
    expect(authed.authorizedFetch).toHaveBeenCalledWith('/favorites');
  });

  it('addFavorite → POST /favorites/:id', async () => {
    authed.authorizedFetch.mockResolvedValue({ favorited: true });
    await addFavorite('l1');
    expect(authed.authorizedFetch).toHaveBeenCalledWith('/favorites/l1', { method: 'POST' });
  });

  it('removeFavorite → DELETE /favorites/:id', async () => {
    authed.authorizedFetch.mockResolvedValue({ favorited: false });
    await removeFavorite('l1');
    expect(authed.authorizedFetch).toHaveBeenCalledWith('/favorites/l1', { method: 'DELETE' });
  });
});
