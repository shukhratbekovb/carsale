import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  markAllNotificationsRead,
  markNotificationRead,
  mockFetchNotifications,
  pushNotification,
  schedulePriceDropDemo,
  subscribeToNotifications,
} from './notifications';

// Same class of shared in-memory module state as lib/mock/chat.ts — the
// notifications array is module-level and persists across tests in this
// file. Tests below assert relative before/after diffs instead of absolute
// counts/order so they stay independent of what earlier tests pushed.
const PREFERENCES_STORAGE_KEY = 'carsale:notification-preferences';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('pushNotification', () => {
  test('creates a notification with the expected fields and prepends it to the feed', async () => {
    const notification = pushNotification('NEW_MESSAGE', 'Новое сообщение', 'Привет!', '/chat/thread-1');

    expect(notification).not.toBeNull();
    expect(notification).toMatchObject({
      type: 'NEW_MESSAGE',
      title: 'Новое сообщение',
      message: 'Привет!',
      link: '/chat/thread-1',
      isRead: false,
    });
    expect(typeof notification?.id).toBe('string');
    expect(typeof notification?.createdAt).toBe('string');

    const feed = await mockFetchNotifications();
    expect(feed[0]?.id).toBe(notification?.id);
  });

  test('emits the created notification to subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToNotifications(listener);

    const notification = pushNotification('LISTING_STATUS', 'Статус', 'На модерации');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(notification);
    unsubscribe();
  });

  test('returns null and does not create a notification when the type is disabled in preferences', async () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ NEW_MESSAGE: true, PRICE_DROP: false, LISTING_STATUS: true })
    );

    const before = await mockFetchNotifications();
    const result = pushNotification('PRICE_DROP', 'Снижение цены', 'Дешевле на 5%');
    const after = await mockFetchNotifications();

    expect(result).toBeNull();
    expect(after.length).toBe(before.length);
  });
});

describe('subscribeToNotifications', () => {
  test('unsubscribe stops the listener from receiving further events', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToNotifications(listener);
    unsubscribe();

    pushNotification('NEW_MESSAGE', 'Заголовок', 'Текст');

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('markNotificationRead / markAllNotificationsRead', () => {
  test('markNotificationRead marks only the targeted notification as read', async () => {
    const a = pushNotification('NEW_MESSAGE', 'A', 'a-message');
    const b = pushNotification('LISTING_STATUS', 'B', 'b-message');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();

    markNotificationRead(a!.id);

    const feed = await mockFetchNotifications();
    expect(feed.find((n) => n.id === a!.id)?.isRead).toBe(true);
    expect(feed.find((n) => n.id === b!.id)?.isRead).toBe(false);
  });

  test('markAllNotificationsRead marks every existing notification as read', async () => {
    pushNotification('NEW_MESSAGE', 'C', 'c-message');
    pushNotification('LISTING_STATUS', 'D', 'd-message');

    markAllNotificationsRead();

    const feed = await mockFetchNotifications();
    expect(feed.every((n) => n.isRead)).toBe(true);
  });
});

describe('schedulePriceDropDemo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('creates nothing before the delay elapses, then a PRICE_DROP notification after 4000-7000ms', async () => {
    const before = await mockFetchNotifications();

    schedulePriceDropDemo('Снижение цены', 'Цена на «Cobalt» снижена', '/catalog/1');

    // Delay floor is 4000ms — nothing should have fired yet.
    await vi.advanceTimersByTimeAsync(3000);
    const mid = await mockFetchNotifications();
    expect(mid.length).toBe(before.length);

    // Advance past the delay ceiling (4000 + up to 3000ms of jitter).
    await vi.advanceTimersByTimeAsync(4000);
    const after = await mockFetchNotifications();
    expect(after.length).toBe(before.length + 1);
    expect(after[0]).toMatchObject({
      type: 'PRICE_DROP',
      title: 'Снижение цены',
      message: 'Цена на «Cobalt» снижена',
      link: '/catalog/1',
      isRead: false,
    });
  });
});
