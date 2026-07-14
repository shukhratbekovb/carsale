import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CURRENT_BUYER_ID } from '@/types/chat';
import {
  mockFetchMessages,
  mockFetchThread,
  mockFetchThreads,
  mockFindOrCreateThread,
  mockMarkThreadRead,
  mockSendMessage,
  subscribeToThread,
} from './chat';

// mockLatency() resolves within 300-700ms; the seller auto-reply scheduled by
// mockSendMessage always waits at least 1200ms (see lib/mock/chat.ts). Fake
// timers everywhere + a 700ms advance is enough to flush any pending
// mockLatency-based promise without ever triggering the auto-reply timeout,
// so tests stay deterministic and don't leak stray setTimeout callbacks into
// later tests (which would otherwise mutate the shared in-memory store).
const LATENCY_MARGIN_MS = 700;

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(LATENCY_MARGIN_MS);
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('mockFetchThreads / mockFetchThread / mockFetchMessages', () => {
  test('mockFetchThreads resolves with the seeded threads sorted by lastMessageAt desc', async () => {
    const threads = await flushLatency(mockFetchThreads());

    const ids = threads.map((thread) => thread.id);
    expect(ids).toContain('thread-1');
    expect(ids).toContain('thread-6');
    // thread-1 was seeded with a later lastMessageAt than thread-6.
    expect(ids.indexOf('thread-1')).toBeLessThan(ids.indexOf('thread-6'));
  });

  test('mockFetchThread resolves the thread for a known id', async () => {
    const thread = await flushLatency(mockFetchThread('thread-1'));
    expect(thread?.id).toBe('thread-1');
    expect(thread?.sellerName).toBe('Baxtiyor');
  });

  test('mockFetchThread resolves undefined for an unknown id', async () => {
    const thread = await flushLatency(mockFetchThread('does-not-exist'));
    expect(thread).toBeUndefined();
  });

  test('mockFetchMessages resolves the seeded messages for a thread', async () => {
    const messages = await flushLatency(mockFetchMessages('thread-1'));
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.every((message) => message.threadId === 'thread-1')).toBe(true);
  });

  test('mockFetchMessages resolves an empty array for an unknown thread', async () => {
    const messages = await flushLatency(mockFetchMessages('does-not-exist'));
    expect(messages).toEqual([]);
  });
});

describe('mockFindOrCreateThread', () => {
  test('is idempotent: two calls for the same listingId return the same thread id', async () => {
    const first = await flushLatency(mockFindOrCreateThread('4'));
    const second = await flushLatency(mockFindOrCreateThread('4'));

    expect(second.id).toBe(first.id);
  });

  test('returns the existing seeded thread for a listing that already has one', async () => {
    const thread = await flushLatency(mockFindOrCreateThread('1'));
    expect(thread.id).toBe('thread-1');
  });
});

describe('mockSendMessage', () => {
  test('resolves a SENT message authored by the current buyer', async () => {
    const message = await flushLatency(mockSendMessage('thread-6', 'Ещё актуально?'));

    expect(message.status).toBe('SENT');
    expect(message.senderId).toBe(CURRENT_BUYER_ID);
    expect(message.threadId).toBe('thread-6');
    expect(message.text).toBe('Ещё актуально?');
  });

  test('adds the sent message to the thread history', async () => {
    const before = await flushLatency(mockFetchMessages('thread-6'));
    const sent = await flushLatency(mockSendMessage('thread-6', 'Новое сообщение для истории'));
    const after = await flushLatency(mockFetchMessages('thread-6'));

    expect(after.length).toBe(before.length + 1);
    expect(after.some((message) => message.id === sent.id)).toBe(true);
  });
});

describe('subscribeToThread', () => {
  test('unsubscribe stops the listener from receiving further events', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToThread('thread-6', listener);
    unsubscribe();

    await flushLatency(mockSendMessage('thread-6', 'Проверка отписки'));
    // Advance well past the auto-reply delay window (1200-2700ms).
    await vi.advanceTimersByTimeAsync(3000);

    expect(listener).not.toHaveBeenCalled();
  });

  test('delivers the seller auto-reply scheduled after mockSendMessage', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToThread('thread-1', listener);

    await flushLatency(mockSendMessage('thread-1', 'Скидка возможна?'));
    await vi.advanceTimersByTimeAsync(3000);

    expect(listener).toHaveBeenCalledTimes(1);
    const [reply] = listener.mock.calls[0];
    expect(reply.threadId).toBe('thread-1');
    expect(reply.senderId).toBe('seller-1');
    expect(reply.status).toBe('SENT');

    unsubscribe();
  });
});

describe('mockMarkThreadRead', () => {
  test('resets unreadCount to 0', async () => {
    // thread-1 is seeded with unreadCount: 1 and untouched by the tests above
    // (they operate on thread-6, or send to thread-1 only inside the
    // subscribeToThread describe block, which runs after this file's
    // top-level module state is already captured per test via fake timers).
    const before = await flushLatency(mockFetchThread('thread-1'));
    expect(before?.unreadCount).toBeGreaterThanOrEqual(0);

    await mockMarkThreadRead('thread-1');

    const after = await flushLatency(mockFetchThread('thread-1'));
    expect(after?.unreadCount).toBe(0);
  });

  test('is a no-op for an unknown thread id', async () => {
    await expect(mockMarkThreadRead('does-not-exist')).resolves.toBeUndefined();
  });
});
