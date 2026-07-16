import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mockListings } from '@/lib/mock/listings';
import {
  __resetAdminMocks,
  approveListing,
  getModerationItem,
  mockFetchAnalytics,
  mockFetchModerationQueue,
  mockFetchUsers,
  rejectListing,
  setUserStatus,
} from './admin';

// mockLatency() резолвится в пределах 300–700 мс (см. lib/mock/admin.ts) —
// тот же паттерн fake timers + flushLatency, что в lib/mock/chat.test.ts:
// продвигаем время на верхнюю границу задержки, тесты остаются детерминированными.
const LATENCY_MARGIN_MS = 700;

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(LATENCY_MARGIN_MS);
  return promise;
}

beforeEach(() => {
  // In-memory «база» общая на модуль — мутации approve/reject/setUserStatus
  // не должны протекать между кейсами.
  __resetAdminMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('mockFetchModerationQueue', () => {
  test('resolves the seeded queue with all PENDING items oldest-first by flaggedAt', async () => {
    const queue = await flushLatency(mockFetchModerationQueue());

    // Seed целиком PENDING, flaggedAt возрастает от mod-1 к mod-5.
    expect(queue.map((item) => item.id)).toEqual(['mod-1', 'mod-2', 'mod-3', 'mod-4', 'mod-5']);
    expect(queue.every((item) => item.status === 'PENDING')).toBe(true);
  });

  test('moves resolved items to the tail, keeping oldest-first order inside each group', async () => {
    approveListing('mod-1');
    rejectListing('mod-3', 'DUPLICATE');

    const queue = await flushLatency(mockFetchModerationQueue());

    // PENDING первыми (oldest-first), решённые — в конце, тоже по flaggedAt.
    expect(queue.map((item) => item.id)).toEqual(['mod-2', 'mod-4', 'mod-5', 'mod-1', 'mod-3']);
  });
});

describe('approveListing / rejectListing', () => {
  test('approveListing marks the item APPROVED with a decidedAt timestamp and persists it', () => {
    const decided = approveListing('mod-1');

    expect(decided?.status).toBe('APPROVED');
    expect(decided?.decision?.decidedAt).toEqual(expect.any(String));
    expect(decided?.decision?.decidedAt).not.toBe('');
    expect(decided?.decision?.rejectReason).toBeUndefined();
    // Решение сохранено в «базе», не только в возвращённом снапшоте.
    expect(getModerationItem('mod-1')?.status).toBe('APPROVED');
  });

  test('rejectListing marks the item REJECTED and stores the reason with the comment', () => {
    const decided = rejectListing('mod-2', 'FRAUD_PRICE', 'Цена вдвое ниже рынка');

    expect(decided?.status).toBe('REJECTED');
    expect(decided?.decision?.decidedAt).toEqual(expect.any(String));
    expect(decided?.decision?.rejectReason).toBe('FRAUD_PRICE');
    expect(decided?.decision?.comment).toBe('Цена вдвое ниже рынка');
    expect(getModerationItem('mod-2')?.status).toBe('REJECTED');
  });

  test('rejectListing without a comment leaves decision.comment undefined', () => {
    const decided = rejectListing('mod-2', 'MISLEADING_INFO');

    expect(decided?.decision?.rejectReason).toBe('MISLEADING_INFO');
    expect(decided?.decision?.comment).toBeUndefined();
  });

  test('a second decision on an already resolved item is a no-op returning the item unchanged', () => {
    const first = approveListing('mod-1');

    // Защита от двойного клика/гонки двух модераторов: повторный reject
    // не перезаписывает уже принятое решение.
    const rejectedAgain = rejectListing('mod-1', 'OTHER', 'поздний клик');
    expect(rejectedAgain).toBe(first);
    expect(rejectedAgain?.status).toBe('APPROVED');
    expect(rejectedAgain?.decision?.rejectReason).toBeUndefined();

    const approvedAgain = approveListing('mod-1');
    expect(approvedAgain).toBe(first);
  });

  test('deciding an unknown id returns undefined', () => {
    expect(approveListing('does-not-exist')).toBeUndefined();
    expect(rejectListing('does-not-exist', 'OTHER')).toBeUndefined();
  });
});

describe('setUserStatus', () => {
  test('changes the user status and persists it for mockFetchUsers', async () => {
    const updated = setUserStatus('user-1', 'BANNED');
    expect(updated?.status).toBe('BANNED');

    const users = await flushLatency(mockFetchUsers());
    expect(users.find((user) => user.id === 'user-1')?.status).toBe('BANNED');
  });

  test('restores a banned user back to ACTIVE', () => {
    // user-6 засеян как BANNED.
    const updated = setUserStatus('user-6', 'ACTIVE');
    expect(updated?.status).toBe('ACTIVE');
  });

  test('returns undefined for an unknown user id', () => {
    expect(setUserStatus('does-not-exist', 'SUSPENDED')).toBeUndefined();
  });
});

describe('mockFetchAnalytics', () => {
  test('derives listing and user counters from the seeded mock data', async () => {
    const queue = await flushLatency(mockFetchModerationQueue());
    const users = await flushLatency(mockFetchUsers());
    const analytics = await flushLatency(mockFetchAnalytics());

    // Всего = публичный каталог + флагнутые снапшоты на модерации.
    expect(analytics.totalListings).toBe(mockListings.length + queue.length);
    expect(analytics.activeListings).toBe(mockListings.length);
    expect(analytics.pendingModeration).toBe(queue.length);
    expect(analytics.rejectedListings).toBe(0);
    expect(analytics.totalUsers).toBe(users.length);
  });

  test('recounts pending/rejected live after a moderation decision', async () => {
    const before = await flushLatency(mockFetchAnalytics());

    rejectListing('mod-2', 'FRAUD_PRICE');

    const after = await flushLatency(mockFetchAnalytics());
    expect(after.pendingModeration).toBe(before.pendingModeration - 1);
    expect(after.rejectedListings).toBe(before.rejectedListings + 1);
    // Одобрение уменьшает pending, но не увеличивает rejected.
    approveListing('mod-1');
    const afterApprove = await flushLatency(mockFetchAnalytics());
    expect(afterApprove.pendingModeration).toBe(before.pendingModeration - 2);
    expect(afterApprove.rejectedListings).toBe(after.rejectedListings);
  });
});
