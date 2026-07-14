import { act, renderHook, waitFor } from '@testing-library/react';
import { useNotifications } from './use-notifications';
import type { AppNotification } from '@/types/notification';

// Same vi.hoisted + vi.mock pattern components/chat/chat-window.test.tsx uses
// for lib/mock/chat: capture the listener passed to subscribeToNotifications
// via closure so tests can invoke it directly and assert the hook's reaction.
const mocks = vi.hoisted(() => ({
  mockFetchNotifications: vi.fn(),
  subscribeToNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock('@/lib/mock/notifications', () => ({
  mockFetchNotifications: mocks.mockFetchNotifications,
  subscribeToNotifications: mocks.subscribeToNotifications,
  markNotificationRead: mocks.markNotificationRead,
  markAllNotificationsRead: mocks.markAllNotificationsRead,
}));

const FIXTURE: AppNotification[] = [
  {
    id: 'n-1',
    type: 'NEW_MESSAGE',
    title: 'Новое сообщение',
    message: 'Привет!',
    isRead: false,
    createdAt: '2026-07-10T10:00:00Z',
  },
  {
    id: 'n-2',
    type: 'LISTING_STATUS',
    title: 'Статус объявления',
    message: 'На модерации',
    isRead: true,
    createdAt: '2026-07-09T10:00:00Z',
  },
];

let capturedListener: ((notification: AppNotification) => void) | undefined;

beforeEach(() => {
  capturedListener = undefined;
  mocks.mockFetchNotifications.mockReset();
  mocks.subscribeToNotifications
    .mockReset()
    .mockImplementation((listener: (notification: AppNotification) => void) => {
      capturedListener = listener;
      return () => {
        capturedListener = undefined;
      };
    });
  mocks.markNotificationRead.mockReset();
  mocks.markAllNotificationsRead.mockReset();
});

test('loads the current feed on mount', async () => {
  mocks.mockFetchNotifications.mockResolvedValue(FIXTURE);
  const { result } = renderHook(() => useNotifications());

  await waitFor(() => expect(result.current.notifications).toHaveLength(2));
  expect(result.current.notifications.map((n) => n.id)).toEqual(['n-1', 'n-2']);
  expect(result.current.unreadCount).toBe(1);
});

test('prepends an incoming notification pushed through the subscription and bumps unreadCount', async () => {
  mocks.mockFetchNotifications.mockResolvedValue(FIXTURE);
  const { result } = renderHook(() => useNotifications());
  await waitFor(() => expect(result.current.notifications).toHaveLength(2));

  expect(capturedListener).toBeInstanceOf(Function);
  const incoming: AppNotification = {
    id: 'n-3',
    type: 'PRICE_DROP',
    title: 'Снижение цены',
    message: 'Цена снижена',
    isRead: false,
    createdAt: '2026-07-11T10:00:00Z',
  };

  act(() => {
    capturedListener?.(incoming);
  });

  expect(result.current.notifications[0]?.id).toBe('n-3');
  expect(result.current.notifications).toHaveLength(3);
  expect(result.current.unreadCount).toBe(2);
});

test('markRead marks a single notification as read, calls the mock module, and does not refetch', async () => {
  mocks.mockFetchNotifications.mockResolvedValue(FIXTURE);
  const { result } = renderHook(() => useNotifications());
  await waitFor(() => expect(result.current.notifications).toHaveLength(2));
  mocks.mockFetchNotifications.mockClear();

  act(() => {
    result.current.markRead('n-1');
  });

  expect(mocks.markNotificationRead).toHaveBeenCalledWith('n-1');
  expect(result.current.notifications.find((n) => n.id === 'n-1')?.isRead).toBe(true);
  expect(result.current.notifications.find((n) => n.id === 'n-2')?.isRead).toBe(true);
  expect(result.current.unreadCount).toBe(0);
  expect(mocks.mockFetchNotifications).not.toHaveBeenCalled();
});

test('markAllRead marks every notification as read and calls the mock module', async () => {
  mocks.mockFetchNotifications.mockResolvedValue(FIXTURE);
  const { result } = renderHook(() => useNotifications());
  await waitFor(() => expect(result.current.notifications).toHaveLength(2));

  act(() => {
    result.current.markAllRead();
  });

  expect(mocks.markAllNotificationsRead).toHaveBeenCalledTimes(1);
  expect(result.current.notifications.every((n) => n.isRead)).toBe(true);
  expect(result.current.unreadCount).toBe(0);
});
