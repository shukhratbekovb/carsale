import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  createNotification: vi.fn(),
  listByUser: vi.fn(),
  countUnread: vi.fn(),
  markAllRead: vi.fn(),
  getUserPrefs: vi.fn(),
  setUserPrefs: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

import { getPreferences, list, notify, setPreferences } from './service.js';

describe('notification service (BE-7)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('notify: тип включён (default) → уведомление создаётся', async () => {
    repo.getUserPrefs.mockResolvedValue(null); // все включены
    repo.createNotification.mockResolvedValue({});
    await notify('u1', 'NEW_MESSAGE', { title: 'T', message: 'M', link: '/chat/x' });
    expect(repo.createNotification).toHaveBeenCalledWith(
      'u1',
      'NEW_MESSAGE',
      expect.objectContaining({ title: 'T', message: 'M', link: '/chat/x' }),
    );
  });

  it('notify: тип отключён в prefs → уведомление НЕ создаётся', async () => {
    repo.getUserPrefs.mockResolvedValue({ NEW_MESSAGE: false, PRICE_DROP: true, LISTING_STATUS: true });
    await notify('u1', 'NEW_MESSAGE', { title: 'T', message: 'M' });
    expect(repo.createNotification).not.toHaveBeenCalled();
  });

  it('notify: best-effort — сбой репозитория не пробрасывается', async () => {
    repo.getUserPrefs.mockRejectedValue(new Error('db down'));
    await expect(notify('u1', 'LISTING_STATUS', { title: 'T', message: 'M' })).resolves.toBeUndefined();
  });

  it('list: маппит payload → title/message/link, isRead из readAt, + unreadCount', async () => {
    repo.listByUser.mockResolvedValue([
      { id: 'n1', type: 'NEW_MESSAGE', payload: { title: 'T1', message: 'M1', link: '/l' }, readAt: null, createdAt: new Date('2026-07-23T00:00:00Z') },
      { id: 'n2', type: 'LISTING_STATUS', payload: { title: 'T2', message: 'M2' }, readAt: new Date(), createdAt: new Date('2026-07-22T00:00:00Z') },
    ]);
    repo.countUnread.mockResolvedValue(1);

    const res = await list('u1');
    expect(res.unreadCount).toBe(1);
    expect(res.items[0]).toMatchObject({ id: 'n1', title: 'T1', message: 'M1', link: '/l', isRead: false });
    expect(res.items[1]).toMatchObject({ id: 'n2', isRead: true });
    expect(res.items[1]).not.toHaveProperty('link');
  });

  it('getPreferences: null → дефолты (все true)', async () => {
    repo.getUserPrefs.mockResolvedValue(null);
    expect(await getPreferences('u1')).toEqual({ NEW_MESSAGE: true, PRICE_DROP: true, LISTING_STATUS: true });
  });

  it('getPreferences: частичный JSON мержится поверх дефолтов', async () => {
    repo.getUserPrefs.mockResolvedValue({ PRICE_DROP: false });
    expect(await getPreferences('u1')).toEqual({ NEW_MESSAGE: true, PRICE_DROP: false, LISTING_STATUS: true });
  });

  it('setPreferences: сохраняет и возвращает', async () => {
    const prefs = { NEW_MESSAGE: false, PRICE_DROP: false, LISTING_STATUS: true };
    expect(await setPreferences('u1', prefs)).toEqual(prefs);
    expect(repo.setUserPrefs).toHaveBeenCalledWith('u1', prefs);
  });
});
