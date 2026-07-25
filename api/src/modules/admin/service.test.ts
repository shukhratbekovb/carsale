import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  findModerationQueue: vi.fn(),
  findModerationItem: vi.fn(),
  sellerCounts: vi.fn(),
  findModerationTarget: vi.fn(),
  decideListing: vi.fn(),
  findUsers: vi.fn(),
  findUserStatus: vi.fn(),
  setUserVerification: vi.fn(),
  analyticsCounts: vi.fn(),
  insertAuditLog: vi.fn(),
  findAuditLogs: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

const notif = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('../notification/service.js', () => notif);

vi.mock('../catalog/cache.js', () => ({ invalidateCatalog: vi.fn() }));

import { approveListing, getAuditLog, rejectListing, setUserStatus } from './service.js';

const ADMIN = 'admin-1';

describe('admin service (BE-8)', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('approveListing', () => {
    it('PENDING_MODERATION → PUBLISHED + уведомление продавцу', async () => {
      repo.findModerationTarget.mockResolvedValue({ id: 'l1', status: 'PENDING_MODERATION', sellerId: 's1' });
      const res = await approveListing('l1', ADMIN);
      expect(res).toEqual({ status: 'PUBLISHED' });
      expect(repo.decideListing).toHaveBeenCalledWith('l1', expect.objectContaining({ status: 'PUBLISHED', fraudFlag: false }));
      expect(notif.notify).toHaveBeenCalledWith('s1', 'LISTING_STATUS', expect.objectContaining({ title: 'Объявление опубликовано' }));
      // BE-8.5: решение зафиксировано в аудит-логе с автором-админом
      expect(repo.insertAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ adminId: ADMIN, action: 'LISTING_APPROVE', targetType: 'LISTING', targetId: 'l1' }),
      );
    });

    it('листинга нет → 404', async () => {
      repo.findModerationTarget.mockResolvedValue(null);
      await expect(approveListing('l1', ADMIN)).rejects.toMatchObject({ status: 404, code: 'listing_not_found' });
      expect(repo.decideListing).not.toHaveBeenCalled();
      expect(repo.insertAuditLog).not.toHaveBeenCalled();
    });

    it('уже PUBLISHED → 409 invalid_status_transition (не PENDING)', async () => {
      repo.findModerationTarget.mockResolvedValue({ id: 'l1', status: 'PUBLISHED', sellerId: 's1' });
      await expect(approveListing('l1', ADMIN)).rejects.toMatchObject({ status: 409, code: 'invalid_status_transition' });
      expect(repo.decideListing).not.toHaveBeenCalled();
      expect(notif.notify).not.toHaveBeenCalled();
      // не мутировали — в журнал ничего не пишем
      expect(repo.insertAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('rejectListing', () => {
    it('PENDING_MODERATION → REJECTED, причина в fraudReason + уведомление', async () => {
      repo.findModerationTarget.mockResolvedValue({ id: 'l1', status: 'PENDING_MODERATION', sellerId: 's1' });
      const res = await rejectListing('l1', { reason: 'DUPLICATE', comment: 'фото совпадают' }, ADMIN);
      expect(res).toEqual({ status: 'REJECTED' });
      expect(repo.decideListing).toHaveBeenCalledWith('l1', expect.objectContaining({ status: 'REJECTED', fraudReason: 'DUPLICATE: фото совпадают' }));
      expect(notif.notify).toHaveBeenCalledWith('s1', 'LISTING_STATUS', expect.objectContaining({ title: 'Объявление отклонено' }));
      expect(repo.insertAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: ADMIN,
          action: 'LISTING_REJECT',
          targetType: 'LISTING',
          targetId: 'l1',
          metadata: expect.objectContaining({ reason: 'DUPLICATE', comment: 'фото совпадают' }),
        }),
      );
    });

    it('без комментария → fraudReason = код причины', async () => {
      repo.findModerationTarget.mockResolvedValue({ id: 'l1', status: 'PENDING_MODERATION', sellerId: 's1' });
      await rejectListing('l1', { reason: 'FRAUD_PRICE' }, ADMIN);
      expect(repo.decideListing).toHaveBeenCalledWith('l1', expect.objectContaining({ fraudReason: 'FRAUD_PRICE' }));
    });
  });

  describe('setUserStatus', () => {
    it('SUSPENDED → verificationStatus SUSPENDED', async () => {
      repo.findUserStatus.mockResolvedValue({ id: 'u1' });
      repo.setUserVerification.mockResolvedValue({ id: 'u1', verificationStatus: 'SUSPENDED', createdAt: new Date(), _count: { listings: 0 } });
      const rec = await setUserStatus('u1', 'SUSPENDED', ADMIN);
      expect(repo.setUserVerification).toHaveBeenCalledWith('u1', 'SUSPENDED');
      expect(rec.status).toBe('SUSPENDED');
      expect(repo.insertAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ adminId: ADMIN, action: 'USER_STATUS_CHANGE', targetType: 'USER', targetId: 'u1', metadata: { status: 'SUSPENDED' } }),
      );
    });

    it('ACTIVE (restore) → PHONE_VERIFIED', async () => {
      repo.findUserStatus.mockResolvedValue({ id: 'u1' });
      repo.setUserVerification.mockResolvedValue({ id: 'u1', verificationStatus: 'PHONE_VERIFIED', createdAt: new Date(), _count: { listings: 0 } });
      await setUserStatus('u1', 'ACTIVE', ADMIN);
      expect(repo.setUserVerification).toHaveBeenCalledWith('u1', 'PHONE_VERIFIED');
    });

    it('пользователя нет → 404', async () => {
      repo.findUserStatus.mockResolvedValue(null);
      await expect(setUserStatus('u1', 'BANNED', ADMIN)).rejects.toMatchObject({ status: 404, code: 'user_not_found' });
      expect(repo.setUserVerification).not.toHaveBeenCalled();
      expect(repo.insertAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('getAuditLog (BE-8.5)', () => {
    it('маппит строки в records с ISO-датой, «сначала свежие»', async () => {
      const created = new Date('2026-07-25T10:00:00.000Z');
      repo.findAuditLogs.mockResolvedValue([
        { id: 'a1', adminId: ADMIN, action: 'LISTING_APPROVE', targetType: 'LISTING', targetId: 'l1', metadata: { to: 'PUBLISHED' }, createdAt: created },
      ]);
      const items = await getAuditLog();
      expect(items).toEqual([
        { id: 'a1', adminId: ADMIN, action: 'LISTING_APPROVE', targetType: 'LISTING', targetId: 'l1', metadata: { to: 'PUBLISHED' }, createdAt: '2026-07-25T10:00:00.000Z' },
      ]);
    });

    it('metadata=null нормализуется в null', async () => {
      repo.findAuditLogs.mockResolvedValue([
        { id: 'a2', adminId: null, action: 'USER_STATUS_CHANGE', targetType: 'USER', targetId: 'u1', metadata: null, createdAt: new Date() },
      ]);
      const [item] = await getAuditLog();
      expect(item?.metadata).toBeNull();
      expect(item?.adminId).toBeNull();
    });
  });
});
