import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  getUserEmail: vi.fn(),
  listPushSubscriptions: vi.fn(),
  deletePushSubscription: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

const mailer = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('./mailer.js', () => ({ getMailer: () => mailer }));

const push = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('./push.js', () => ({ getPushSender: () => push }));

vi.mock('../../lib/queue.js', () => ({ consumeQueue: vi.fn() }));

import { handleDelivery } from './delivery-consumer.js';

const EVENT = { user_id: 'u1', type: 'NEW_MESSAGE', title: 'T', message: 'M', link: '/chat/1' };

describe('delivery-consumer handleDelivery (BE-7.2/7.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mailer.send.mockResolvedValue(undefined);
    push.send.mockResolvedValue({ gone: false });
    repo.getUserEmail.mockResolvedValue(null);
    repo.listPushSubscriptions.mockResolvedValue([]);
  });

  it('битое событие → no-op', async () => {
    await handleDelivery({ nope: true });
    expect(repo.getUserEmail).not.toHaveBeenCalled();
  });

  it('email задан → отправка письма (subject=title, link добавлен)', async () => {
    repo.getUserEmail.mockResolvedValue('a@b.uz');
    await handleDelivery(EVENT);
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.uz', subject: 'T', text: 'M', link: '/chat/1' }),
    );
  });

  it('email не задан → письмо не шлётся', async () => {
    repo.getUserEmail.mockResolvedValue(null);
    await handleDelivery(EVENT);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('push: доставка во все подписки', async () => {
    repo.listPushSubscriptions.mockResolvedValue([
      { id: 's1', endpoint: 'e1', p256dh: 'p1', auth: 'a1' },
      { id: 's2', endpoint: 'e2', p256dh: 'p2', auth: 'a2' },
    ]);
    await handleDelivery(EVENT);
    expect(push.send).toHaveBeenCalledTimes(2);
  });

  it('push gone (410) → подписка удаляется', async () => {
    repo.listPushSubscriptions.mockResolvedValue([{ id: 's1', endpoint: 'dead', p256dh: 'p', auth: 'a' }]);
    push.send.mockResolvedValue({ gone: true });
    await handleDelivery(EVENT);
    expect(repo.deletePushSubscription).toHaveBeenCalledWith('dead');
  });

  it('сбой email не мешает push и наоборот (best-effort)', async () => {
    repo.getUserEmail.mockResolvedValue('a@b.uz');
    mailer.send.mockRejectedValue(new Error('smtp down'));
    repo.listPushSubscriptions.mockResolvedValue([{ id: 's1', endpoint: 'e1', p256dh: 'p', auth: 'a' }]);
    await expect(handleDelivery(EVENT)).resolves.toBeUndefined();
    expect(push.send).toHaveBeenCalledTimes(1);
  });
});
