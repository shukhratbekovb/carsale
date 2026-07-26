import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  listFavoriteListings: vi.fn(),
  listFavoriteIds: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  findPublishedListing: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

// Переиспользуемая проекция каталога — мокаем как identity-обёртку
vi.mock('../catalog/mapper.js', () => ({
  toPublicListing: (row: { id: string }) => ({ id: row.id, mapped: true }),
}));

import { addFavorite, getFavoriteIds, getFavorites, removeFavorite } from './service.js';

describe('favorites service (FR-13)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getFavorites: маппит строки публичной проекцией', async () => {
    repo.listFavoriteListings.mockResolvedValue([{ id: 'l1' }, { id: 'l2' }]);
    const res = await getFavorites('u1');
    expect(repo.listFavoriteListings).toHaveBeenCalledWith('u1');
    expect(res).toEqual({ items: [{ id: 'l1', mapped: true }, { id: 'l2', mapped: true }] });
  });

  it('getFavoriteIds: отдаёт { ids }', async () => {
    repo.listFavoriteIds.mockResolvedValue(['l1', 'l2']);
    expect(await getFavoriteIds('u1')).toEqual({ ids: ['l1', 'l2'] });
    expect(repo.listFavoriteIds).toHaveBeenCalledWith('u1');
  });

  it('addFavorite: PUBLISHED существует → upsert + favorited:true', async () => {
    repo.findPublishedListing.mockResolvedValue({ id: 'l1' });
    const res = await addFavorite('u1', 'l1');
    expect(repo.addFavorite).toHaveBeenCalledWith('u1', 'l1');
    expect(res).toEqual({ listingId: 'l1', favorited: true });
  });

  it('addFavorite: объявления нет/не опубликовано → 404, без upsert', async () => {
    repo.findPublishedListing.mockResolvedValue(null);
    await expect(addFavorite('u1', 'l1')).rejects.toMatchObject({ status: 404, code: 'listing_not_found' });
    expect(repo.addFavorite).not.toHaveBeenCalled();
  });

  it('removeFavorite: идемпотентно → favorited:false', async () => {
    const res = await removeFavorite('u1', 'l1');
    expect(repo.removeFavorite).toHaveBeenCalledWith('u1', 'l1');
    expect(res).toEqual({ listingId: 'l1', favorited: false });
  });
});
