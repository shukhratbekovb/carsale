import { beforeEach, describe, expect, it, vi } from 'vitest';

// Мокаем репозиторий и ML-клиент — тест проверяет оркестрацию estimatePrice
const repo = vi.hoisted(() => ({
  findEstimateSource: vi.fn(),
  saveDealRating: vi.fn(),
  // не используются в этих тестах, но модуль их импортирует
  createDraft: vi.fn(),
  findOwnedState: vi.fn(),
  listBySeller: vi.fn(),
  setStatus: vi.fn(),
  updateDraft: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

const ml = vi.hoisted(() => ({ mlDealRating: vi.fn() }));
vi.mock('../../lib/ml-client.js', () => ml);
vi.mock('../../lib/queue.js', () => ({ publishEvent: vi.fn() }));
vi.mock('../notification/service.js', () => ({ notify: vi.fn() }));

import { AppError } from '../../lib/errors.js';
import { estimatePrice } from './service.js';

const SRC = {
  make: 'Chevrolet',
  model: 'Cobalt',
  year: 2020,
  mileage: 40000,
  condition: 'GOOD',
  city: 'Tashkent',
  priceUzs: 150_000_000,
};

describe('estimatePrice (BE-3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.saveDealRating.mockResolvedValue(undefined); // всегда возвращает промис
  });

  it('нет объявления/не владелец → 404', async () => {
    repo.findEstimateSource.mockResolvedValue(null);
    await expect(estimatePrice('id', 'seller')).rejects.toMatchObject({ code: 'listing_not_found' });
  });

  it('успех ML → метка + диапазон, вердикт сохранён', async () => {
    repo.findEstimateSource.mockResolvedValue(SRC);
    ml.mlDealRating.mockResolvedValue({
      label: 'FAIR_PRICE',
      score: 0.9,
      recommended_min_uzs: 140_000_000,
      recommended_max_uzs: 160_000_000,
      computed_at: '2026-07-21T10:00:00Z',
    });

    const res = await estimatePrice('id', 'seller');
    expect(res).toEqual({ label: 'FAIR_PRICE', recommendedMin: 140_000_000, recommendedMax: 160_000_000 });
    expect(repo.saveDealRating).toHaveBeenCalledWith('id', expect.objectContaining({ label: 'FAIR_PRICE' }));
    // ML получил mileage (не mileageKm) и price_uzs
    expect(ml.mlDealRating).toHaveBeenCalledWith(expect.objectContaining({ mileage: 40000, price_uzs: 150_000_000 }));
  });

  it('ML недоступен → UNAVAILABLE (без диапазона), метка всё равно сохранена', async () => {
    repo.findEstimateSource.mockResolvedValue(SRC);
    ml.mlDealRating.mockRejectedValue(new AppError(503, 'ml_unavailable', 'down'));

    const res = await estimatePrice('id', 'seller');
    expect(res).toEqual({ label: 'UNAVAILABLE' });
    expect(repo.saveDealRating).toHaveBeenCalledWith('id', expect.objectContaining({ label: 'UNAVAILABLE', recommendedMin: null }));
  });

  it('неизвестная метка от ML нормализуется в UNAVAILABLE', async () => {
    repo.findEstimateSource.mockResolvedValue(SRC);
    ml.mlDealRating.mockResolvedValue({
      label: 'WEIRD',
      score: 0.5,
      recommended_min_uzs: null,
      recommended_max_uzs: null,
      computed_at: '2026-07-21T10:00:00Z',
    });
    const res = await estimatePrice('id', 'seller');
    expect(res.label).toBe('UNAVAILABLE');
  });
});
