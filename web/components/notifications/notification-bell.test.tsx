import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@/src/test/utils';
import { NotificationBell } from './notification-bell';
import type { AppNotification } from '@/types/notification';

// Same vi.hoisted + vi.mock pattern as components/chat/chat-window.test.tsx —
// NotificationBell talks to lib/mock/notifications through the real
// useNotifications hook, so we mock the mock-data module itself rather than
// the hook (nothing in the codebase mocks hooks/use-notifications directly).
const notifications = vi.hoisted(() => ({
  mockFetchNotifications: vi.fn(),
  subscribeToNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock('@/lib/mock/notifications', () => ({
  mockFetchNotifications: notifications.mockFetchNotifications,
  subscribeToNotifications: notifications.subscribeToNotifications,
  markNotificationRead: notifications.markNotificationRead,
  markAllNotificationsRead: notifications.markAllNotificationsRead,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

const FIXTURE: AppNotification[] = [
  {
    id: 'n-1',
    type: 'NEW_MESSAGE',
    title: 'Новое сообщение',
    message: 'Ещё актуально?',
    link: '/catalog/1',
    isRead: false,
    createdAt: '2026-07-10T10:00:00Z',
  },
  {
    id: 'n-2',
    type: 'PRICE_DROP',
    title: 'Снижение цены',
    message: 'Цена на «Cobalt» снижена',
    link: '/catalog/2',
    isRead: false,
    createdAt: '2026-07-10T09:00:00Z',
  },
  {
    id: 'n-3',
    type: 'LISTING_STATUS',
    title: 'Статус объявления',
    message: 'Объявление опубликовано',
    isRead: true,
    createdAt: '2026-07-09T09:00:00Z',
  },
];

beforeEach(() => {
  notifications.mockFetchNotifications.mockReset();
  notifications.subscribeToNotifications.mockReset().mockReturnValue(() => {});
  notifications.markNotificationRead.mockReset();
  notifications.markAllNotificationsRead.mockReset();
});

test('shows the bare bell label and no numeric badge when there are no unread notifications', async () => {
  notifications.mockFetchNotifications.mockResolvedValue([]);
  render(<NotificationBell />);

  const button = await screen.findByRole('button', { name: 'Уведомления' });
  expect(within(button).queryByText(/^\d+(\+)?$/)).not.toBeInTheDocument();
});

test('shows the ICU-pluralized unread count in the aria-label and a numeric badge', async () => {
  notifications.mockFetchNotifications.mockResolvedValue(FIXTURE);
  render(<NotificationBell />);

  const button = await screen.findByRole('button', { name: '2 непрочитанных' });
  expect(within(button).getByText('2')).toBeInTheDocument();
});

test('opening the panel lists every notification, bolding the unread ones', async () => {
  notifications.mockFetchNotifications.mockResolvedValue(FIXTURE);
  const user = userEvent.setup();
  render(<NotificationBell />);

  await user.click(await screen.findByRole('button', { name: '2 непрочитанных' }));

  const unreadItem = screen.getByText('Новое сообщение');
  const readItem = screen.getByText('Статус объявления');
  expect(unreadItem).toHaveClass('font-semibold');
  expect(readItem).not.toHaveClass('font-semibold');
  expect(screen.getByText('Ещё актуально?')).toBeInTheDocument();
  expect(screen.getByText('Объявление опубликовано')).toBeInTheDocument();
});

test('clicking a notification with a link navigates to it and marks it read', async () => {
  notifications.mockFetchNotifications.mockResolvedValue(FIXTURE);
  const user = userEvent.setup();
  render(<NotificationBell />);

  await user.click(await screen.findByRole('button', { name: '2 непрочитанных' }));
  const link = screen.getByRole('link', { name: /Новое сообщение/ });
  expect(link).toHaveAttribute('href', '/catalog/1');

  await user.click(link);

  expect(notifications.markNotificationRead).toHaveBeenCalledWith('n-1');
});

test('shows "mark all read" only when there are unread notifications and it marks them all read', async () => {
  notifications.mockFetchNotifications.mockResolvedValue(FIXTURE);
  const user = userEvent.setup();
  render(<NotificationBell />);

  await user.click(await screen.findByRole('button', { name: '2 непрочитанных' }));

  const markAllButton = screen.getByRole('button', { name: 'Отметить все прочитанными' });
  await user.click(markAllButton);

  expect(notifications.markAllNotificationsRead).toHaveBeenCalledTimes(1);
});

test('hides "mark all read" when there are no unread notifications', async () => {
  notifications.mockFetchNotifications.mockResolvedValue([FIXTURE[2]]);
  const user = userEvent.setup();
  render(<NotificationBell />);

  await user.click(await screen.findByRole('button', { name: 'Уведомления' }));

  expect(screen.queryByRole('button', { name: 'Отметить все прочитанными' })).not.toBeInTheDocument();
});

test('shows the empty state when there are no notifications at all', async () => {
  notifications.mockFetchNotifications.mockResolvedValue([]);
  const user = userEvent.setup();
  render(<NotificationBell />);

  await user.click(await screen.findByRole('button', { name: 'Уведомления' }));

  expect(screen.getByText('Пока нет уведомлений')).toBeInTheDocument();
});

test('always shows a settings link to /profile', async () => {
  notifications.mockFetchNotifications.mockResolvedValue(FIXTURE);
  const user = userEvent.setup();
  render(<NotificationBell />);

  await user.click(await screen.findByRole('button', { name: '2 непрочитанных' }));

  expect(screen.getByRole('link', { name: 'Настройки уведомлений' })).toHaveAttribute('href', '/profile');
});
