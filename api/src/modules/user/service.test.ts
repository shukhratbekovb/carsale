import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  findProfile: vi.fn(),
  setMarketingConsent: vi.fn(),
  gatherExport: vi.fn(),
  anonymizeAndSoftDelete: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

const jwtMock = vi.hoisted(() => ({ revokeAllUserTokens: vi.fn() }));
vi.mock('../../lib/jwt.js', () => jwtMock);

import { exportData, getProfile, requestDeletion, updateConsents } from './service.js';

const decimal = (n: number) => ({ toNumber: () => n }) as never;

const PROFILE = {
  id: 'u1',
  email: 'a@b.uz',
  role: 'BUYER',
  verificationStatus: 'PHONE_VERIFIED',
  marketingConsent: true,
  createdAt: new Date('2026-07-01T10:00:00Z'),
  deletedAt: null,
};

describe('user service (BE-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jwtMock.revokeAllUserTokens.mockResolvedValue(undefined);
  });

  describe('getProfile', () => {
    it('маскированный телефон, personalData=true, acceptedAt=createdAt', async () => {
      repo.findProfile.mockResolvedValue(PROFILE);
      const p = await getProfile('u1');
      expect(p.phone).toBe('+998 ** *** ** **');
      expect(p.consents).toEqual({
        personalData: true,
        marketing: true,
        acceptedAt: '2026-07-01T10:00:00.000Z',
      });
    });

    it('нет пользователя → 404', async () => {
      repo.findProfile.mockResolvedValue(null);
      await expect(getProfile('u1')).rejects.toMatchObject({ status: 404, code: 'user_not_found' });
    });
  });

  it('updateConsents: отзыв маркетинга → сохраняет и возвращает согласия', async () => {
    repo.setMarketingConsent.mockResolvedValue({ ...PROFILE, marketingConsent: false });
    const c = await updateConsents('u1', false);
    expect(repo.setMarketingConsent).toHaveBeenCalledWith('u1', false);
    expect(c.marketing).toBe(false);
    expect(c.personalData).toBe(true);
  });

  it('exportData: device=false, Decimal→number, даты→ISO', async () => {
    repo.gatherExport.mockResolvedValue({
      profile: PROFILE,
      listings: [{ id: 'l1', status: 'PUBLISHED', priceUzs: decimal(150_000_000), city: 'T', description: null, createdAt: new Date('2026-07-02T00:00:00Z'), vehicle: null, photos: [] }],
      favorites: [{ listingId: 'l9', createdAt: new Date('2026-07-03T00:00:00Z') }],
      savedSearches: [],
      payments: [{ id: 'p1', paymentType: 'VEHICLE_REPORT', amountUzs: decimal(45000), status: 'SUCCESS', gateway: 'CLICK', createdAt: new Date('2026-07-04T00:00:00Z') }],
      notifications: [{ type: 'NEW_MESSAGE', payload: {}, createdAt: new Date('2026-07-05T00:00:00Z'), readAt: null }],
      messages: [{ threadId: 't1', text: 'hi', sentAt: new Date('2026-07-06T00:00:00Z') }],
    });
    const e = await exportData('u1');
    expect(e.device).toBe(false);
    expect((e.listings as { priceUzs: number }[])[0]?.priceUzs).toBe(150_000_000);
    expect((e.payments as { amountUzs: number }[])[0]?.amountUzs).toBe(45000);
    expect((e.messages as { sentAt: string }[])[0]?.sentAt).toBe('2026-07-06T00:00:00.000Z');
  });

  describe('requestDeletion', () => {
    it('активный аккаунт → анонимизация + отзыв токенов + квитанция с dueBy', async () => {
      repo.findProfile.mockResolvedValue(PROFILE);
      const r = await requestDeletion('u1');
      expect(repo.anonymizeAndSoftDelete).toHaveBeenCalledWith('u1', expect.any(Date));
      expect(jwtMock.revokeAllUserTokens).toHaveBeenCalledWith('u1');
      expect(r.requestedAt).toBeTruthy();
      expect(new Date(r.dueBy).getTime()).toBeGreaterThan(new Date(r.requestedAt).getTime());
    });

    it('уже удалён → идемпотентно, без повторной анонимизации', async () => {
      repo.findProfile.mockResolvedValue({ ...PROFILE, deletedAt: new Date('2026-07-10T00:00:00Z') });
      const r = await requestDeletion('u1');
      expect(repo.anonymizeAndSoftDelete).not.toHaveBeenCalled();
      expect(jwtMock.revokeAllUserTokens).not.toHaveBeenCalled();
      expect(r.requestedAt).toBe('2026-07-10T00:00:00.000Z');
    });

    it('нет пользователя → 404', async () => {
      repo.findProfile.mockResolvedValue(null);
      await expect(requestDeletion('u1')).rejects.toMatchObject({ status: 404 });
    });
  });
});
