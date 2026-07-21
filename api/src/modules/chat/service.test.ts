import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  getPublishedListingSeller: vi.fn(),
  findThreadByListingBuyer: vi.fn(),
  createThread: vi.fn(),
  listThreadsForUser: vi.fn(),
  getThreadIfParticipant: vi.fn(),
  isParticipant: vi.fn(),
  listMessages: vi.fn(),
  createMessage: vi.fn(),
  markThreadRead: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

import { findOrCreateThread, getMessages, listThreads, sendMessage } from './service.js';

// Ряд треда в форме threadSelect
function threadRow(over: Record<string, unknown> = {}) {
  return {
    id: 'thread-1',
    listingId: 'listing-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    lastMessageAt: new Date('2026-07-10T14:32:00Z'),
    listing: { vehicle: { make: 'Chevrolet', model: 'Cobalt', year: 2019 } },
    messages: [{ text: 'Да, в продаже' }],
    _count: { messages: 2 },
    ...over,
  };
}

describe('chat service (BE-5.1/5.4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('findOrCreateThread: объявление не найдено → 404', async () => {
    repo.getPublishedListingSeller.mockResolvedValue(null);
    await expect(findOrCreateThread('buyer-1', 'listing-1')).rejects.toMatchObject({
      code: 'listing_not_found',
    });
  });

  it('findOrCreateThread: свой листинг → 400 cannot_chat_with_self', async () => {
    repo.getPublishedListingSeller.mockResolvedValue({ sellerId: 'buyer-1' });
    await expect(findOrCreateThread('buyer-1', 'listing-1')).rejects.toMatchObject({
      code: 'cannot_chat_with_self',
    });
  });

  it('findOrCreateThread: существующий тред → created=false, DTO смаплен', async () => {
    repo.getPublishedListingSeller.mockResolvedValue({ sellerId: 'seller-1' });
    repo.findThreadByListingBuyer.mockResolvedValue(threadRow());

    const { thread, created } = await findOrCreateThread('buyer-1', 'listing-1');
    expect(created).toBe(false);
    expect(thread).toMatchObject({
      id: 'thread-1',
      listingTitle: 'Chevrolet Cobalt, 2019',
      sellerName: 'Продавец', // плейсхолдер: имени нет в модели данных
      lastMessagePreview: 'Да, в продаже',
      unreadCount: 2,
    });
    expect(repo.createThread).not.toHaveBeenCalled();
  });

  it('findOrCreateThread: нового треда нет → создаётся, created=true', async () => {
    repo.getPublishedListingSeller.mockResolvedValue({ sellerId: 'seller-1' });
    repo.findThreadByListingBuyer.mockResolvedValue(null);
    repo.createThread.mockResolvedValue(threadRow({ messages: [], _count: { messages: 0 }, lastMessageAt: null }));

    const { thread, created } = await findOrCreateThread('buyer-1', 'listing-1');
    expect(created).toBe(true);
    expect(thread.lastMessageAt).toBe('');
    expect(thread.lastMessagePreview).toBe('');
    expect(repo.createThread).toHaveBeenCalledWith('listing-1', 'buyer-1', 'seller-1', 'buyer-1');
  });

  it('getMessages/sendMessage: не участник → 404', async () => {
    repo.isParticipant.mockResolvedValue(false);
    await expect(getMessages('t', 'intruder')).rejects.toMatchObject({ code: 'thread_not_found' });
    await expect(sendMessage('t', 'intruder', 'hi')).rejects.toMatchObject({ code: 'thread_not_found' });
  });

  it('sendMessage: участник → создаёт сообщение, статус SENT', async () => {
    repo.isParticipant.mockResolvedValue(true);
    repo.createMessage.mockResolvedValue({
      id: 'm1', threadId: 't', senderId: 'buyer-1', text: 'hi', sentAt: new Date('2026-07-21T00:00:00Z'),
    });
    const msg = await sendMessage('t', 'buyer-1', 'hi');
    expect(msg).toMatchObject({ id: 'm1', status: 'SENT', sentAt: '2026-07-21T00:00:00.000Z' });
  });

  it('listThreads маппит все треды пользователя', async () => {
    repo.listThreadsForUser.mockResolvedValue([threadRow(), threadRow({ id: 'thread-2' })]);
    const list = await listThreads('buyer-1');
    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe('thread-1');
  });
});
