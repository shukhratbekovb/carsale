import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  findFraudSource: vi.fn(),
  findOtherPhotoHashes: vi.fn(),
  saveFraudDecision: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

const ml = vi.hoisted(() => ({ mlFraudCheck: vi.fn() }));
vi.mock('../../lib/ml-client.js', () => ml);

const notif = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('../notification/service.js', () => notif);

vi.mock('../../lib/queue.js', () => ({ consumeQueue: vi.fn() }));

import { handleFraudCheck } from './fraud-consumer.js';

const SRC = {
  status: 'PENDING_MODERATION' as const,
  sellerId: 's1',
  fraudFlag: false,
  make: 'Chevrolet',
  model: 'Cobalt',
  year: 2020,
  mileage: 40000,
  condition: 'GOOD',
  city: 'Tashkent',
  priceUzs: 90_000_000,
  phashes: ['ff00ff00ff00ff00'],
};

const NO_ANOMALY = { priceAnomaly: false, deviationPercent: 0, predictedMedianUzs: null };

describe('fraud-consumer handleFraudCheck (BE-3.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.saveFraudDecision.mockResolvedValue(undefined);
    repo.findOtherPhotoHashes.mockResolvedValue([]);
    ml.mlFraudCheck.mockResolvedValue(NO_ANOMALY);
  });

  it('нет listing_id → no-op', async () => {
    await handleFraudCheck({ action: 'fraud_check' });
    expect(repo.findFraudSource).not.toHaveBeenCalled();
  });

  it('не PENDING_MODERATION → skip (идемпотентность)', async () => {
    repo.findFraudSource.mockResolvedValue({ ...SRC, status: 'PUBLISHED' });
    await handleFraudCheck({ listing_id: 'l1' });
    expect(repo.saveFraudDecision).not.toHaveBeenCalled();
  });

  it('уже флагнут (fraudFlag=true) → skip', async () => {
    repo.findFraudSource.mockResolvedValue({ ...SRC, fraudFlag: true });
    await handleFraudCheck({ listing_id: 'l1' });
    expect(repo.saveFraudDecision).not.toHaveBeenCalled();
  });

  it('чисто → PUBLISHED + publishedAt + уведомление «опубликовано»', async () => {
    repo.findFraudSource.mockResolvedValue(SRC);
    await handleFraudCheck({ listing_id: 'l1' });
    expect(repo.saveFraudDecision).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ status: 'PUBLISHED', fraudFlag: false, fraudReason: null, publishedAt: expect.any(Date) }),
    );
    expect(notif.notify).toHaveBeenCalledWith('s1', 'LISTING_STATUS', expect.objectContaining({ title: 'Объявление опубликовано' }));
  });

  it('ценовая аномалия → остаётся PENDING_MODERATION + fraudFlag + причина', async () => {
    repo.findFraudSource.mockResolvedValue(SRC);
    ml.mlFraudCheck.mockResolvedValue({ priceAnomaly: true, deviationPercent: 70, predictedMedianUzs: 300_000_000 });
    await handleFraudCheck({ listing_id: 'l1' });
    expect(repo.saveFraudDecision).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ status: 'PENDING_MODERATION', fraudFlag: true, fraudReason: 'PRICE_ANOMALY:70' }),
    );
    expect(repo.saveFraudDecision).toHaveBeenCalledWith('l1', expect.not.objectContaining({ publishedAt: expect.anything() }));
    expect(notif.notify).toHaveBeenCalledWith('s1', 'LISTING_STATUS', expect.objectContaining({ title: 'Объявление на проверке' }));
  });

  it('дубль фото → flagged, причина DUPLICATE_PHOTOS:<id>', async () => {
    repo.findFraudSource.mockResolvedValue(SRC);
    // кандидат с тем же хешем → дистанция 0 ≤ 8
    repo.findOtherPhotoHashes.mockResolvedValue([{ listingId: 'other-9', phash: 'ff00ff00ff00ff00' }]);
    await handleFraudCheck({ listing_id: 'l1' });
    expect(repo.saveFraudDecision).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ status: 'PENDING_MODERATION', fraudFlag: true, fraudReason: 'DUPLICATE_PHOTOS:other-9' }),
    );
  });

  it('дубль + аномалия → обе причины через "; "', async () => {
    repo.findFraudSource.mockResolvedValue(SRC);
    repo.findOtherPhotoHashes.mockResolvedValue([{ listingId: 'other-9', phash: 'ff00ff00ff00ff00' }]);
    ml.mlFraudCheck.mockResolvedValue({ priceAnomaly: true, deviationPercent: 65, predictedMedianUzs: 250_000_000 });
    await handleFraudCheck({ listing_id: 'l1' });
    expect(repo.saveFraudDecision).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ fraudReason: 'DUPLICATE_PHOTOS:other-9; PRICE_ANOMALY:65' }),
    );
  });
});
