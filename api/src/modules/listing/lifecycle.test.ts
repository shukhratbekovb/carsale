import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  findOwnedState: vi.fn(),
  updateDraft: vi.fn(),
  expirePublished: vi.fn(),
  findUnavailableForRetry: vi.fn(),
  findEstimateSourceById: vi.fn(),
  findEstimateSource: vi.fn(),
  saveDealRating: vi.fn(),
  createDraft: vi.fn(),
  listBySeller: vi.fn(),
  setStatus: vi.fn(),
  createPhoto: vi.fn(),
  listPhotos: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

const ml = vi.hoisted(() => ({ mlDealRating: vi.fn(), mlBlur: vi.fn() }));
vi.mock('../../lib/ml-client.js', () => ml);

const queue = vi.hoisted(() => ({ publishEvent: vi.fn() }));
vi.mock('../../lib/queue.js', () => queue);

const notif = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('../notification/service.js', () => notif);

const cache = vi.hoisted(() => ({ invalidateCatalog: vi.fn() }));
vi.mock('../catalog/cache.js', () => cache);

vi.mock('../../lib/s3.js', () => ({ putObject: vi.fn() }));

import { AppError } from '../../lib/errors.js';
import {
  computeExpiry,
  expireListingsJob,
  LISTING_TTL_DAYS,
  retryDealRatingJob,
  updateDraft,
} from './service.js';

const ESTIMATE_SRC = {
  make: 'Chevrolet',
  model: 'Cobalt',
  year: 2020,
  mileage: 40000,
  condition: 'GOOD',
  city: 'Tashkent',
  priceUzs: 150_000_000,
};

describe('listing lifecycle (BE-3.7/3.8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.saveDealRating.mockResolvedValue(undefined);
    ml.mlDealRating.mockResolvedValue({ label: 'FAIR_PRICE', score: 0.9, recommended_min_uzs: 1, recommended_max_uzs: 2, computed_at: '2026-07-24T00:00:00Z' });
  });

  describe('updateDraft (BE-3.8)', () => {
    it('DRAFT: правка на месте, без re-moderation', async () => {
      repo.findOwnedState.mockResolvedValue({ status: 'DRAFT', photoCount: 1 });
      repo.findEstimateSourceById.mockResolvedValue(ESTIMATE_SRC);
      await updateDraft('l1', 's1', { priceUzs: 140_000_000 });
      expect(repo.updateDraft).toHaveBeenCalledWith('l1', { priceUzs: 140_000_000 }, undefined);
      expect(queue.publishEvent).not.toHaveBeenCalled();
      // смена цены → пересчёт оценки
      expect(repo.findEstimateSourceById).toHaveBeenCalledWith('l1');
    });

    it('PUBLISHED: любое изменение → повторная модерация (PENDING) + fraud_check + инвалидация + notify', async () => {
      repo.findOwnedState.mockResolvedValue({ status: 'PUBLISHED', photoCount: 3 });
      repo.findEstimateSourceById.mockResolvedValue(ESTIMATE_SRC);
      await updateDraft('l1', 's1', { priceUzs: 130_000_000 });
      expect(repo.updateDraft).toHaveBeenCalledWith('l1', { priceUzs: 130_000_000 }, 'PENDING_MODERATION');
      expect(cache.invalidateCatalog).toHaveBeenCalled();
      expect(queue.publishEvent).toHaveBeenCalledWith('fraud_check', { action: 'fraud_check', listing_id: 'l1' });
      expect(notif.notify).toHaveBeenCalledWith('s1', 'LISTING_STATUS', expect.objectContaining({ title: 'Объявление на повторной модерации' }));
    });

    it('без смены цены → пересчёт оценки не запускается', async () => {
      repo.findOwnedState.mockResolvedValue({ status: 'DRAFT', photoCount: 1 });
      await updateDraft('l1', 's1', { city: 'Samarkand' });
      expect(repo.findEstimateSourceById).not.toHaveBeenCalled();
    });

    it('SOLD (нередактируемый, не PUBLISHED) → 409', async () => {
      repo.findOwnedState.mockResolvedValue({ status: 'SOLD', photoCount: 1 });
      await expect(updateDraft('l1', 's1', { priceUzs: 1 })).rejects.toMatchObject({ status: 409, code: 'listing_not_editable' });
    });

    it('не владелец → 404', async () => {
      repo.findOwnedState.mockResolvedValue(null);
      await expect(updateDraft('l1', 's1', { priceUzs: 1 })).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('computeExpiry', () => {
    it('= дата + 30 дней', () => {
      const from = new Date('2026-07-24T00:00:00Z');
      const exp = computeExpiry(from);
      expect(exp.getTime() - from.getTime()).toBe(LISTING_TTL_DAYS * 86_400_000);
    });
  });

  describe('expireListingsJob (BE-3.7)', () => {
    it('нет истёкших → no-op', async () => {
      repo.expirePublished.mockResolvedValue([]);
      await expireListingsJob();
      expect(cache.invalidateCatalog).not.toHaveBeenCalled();
      expect(notif.notify).not.toHaveBeenCalled();
    });

    it('истёкшие → инвалидация каталога + уведомление каждому продавцу', async () => {
      repo.expirePublished.mockResolvedValue([
        { id: 'l1', sellerId: 's1' },
        { id: 'l2', sellerId: 's2' },
      ]);
      await expireListingsJob();
      expect(cache.invalidateCatalog).toHaveBeenCalledTimes(1);
      expect(notif.notify).toHaveBeenCalledTimes(2);
      expect(notif.notify).toHaveBeenCalledWith('s1', 'LISTING_STATUS', expect.objectContaining({ title: 'Срок объявления истёк' }));
    });
  });

  describe('retryDealRatingJob (BE-3.7)', () => {
    it('пересчитывает оценку для каждого UNAVAILABLE', async () => {
      repo.findUnavailableForRetry.mockResolvedValue(['l1', 'l2']);
      repo.findEstimateSourceById.mockResolvedValue(ESTIMATE_SRC);
      await retryDealRatingJob();
      expect(ml.mlDealRating).toHaveBeenCalledTimes(2);
      expect(repo.saveDealRating).toHaveBeenCalledTimes(2);
    });

    it('пустой список → ML не зовётся', async () => {
      repo.findUnavailableForRetry.mockResolvedValue([]);
      await retryDealRatingJob();
      expect(ml.mlDealRating).not.toHaveBeenCalled();
    });
  });
});
