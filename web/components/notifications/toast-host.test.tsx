import userEvent from '@testing-library/user-event';
import { act, render, screen } from '@/src/test/utils';
import { ToastHost } from './toast-host';
import type { AppNotification } from '@/types/notification';

// Same vi.hoisted + vi.mock pattern as components/chat/chat-window.test.tsx —
// capture the listener passed to subscribeToNotifications via closure so
// tests can push notifications directly and assert the toast reacts.
const notifications = vi.hoisted(() => ({
  subscribeToNotifications: vi.fn(),
}));

vi.mock('@/lib/mock/notifications', () => ({
  subscribeToNotifications: notifications.subscribeToNotifications,
}));

const TOAST_NOTIFICATION: AppNotification = {
  id: 'n-1',
  type: 'NEW_MESSAGE',
  title: 'Новое сообщение',
  message: 'Ещё актуально?',
  isRead: false,
  createdAt: '2026-07-10T10:00:00Z',
};

let capturedListener: ((notification: AppNotification) => void) | undefined;

beforeEach(() => {
  capturedListener = undefined;
  notifications.subscribeToNotifications
    .mockReset()
    .mockImplementation((listener: (notification: AppNotification) => void) => {
      capturedListener = listener;
      return () => {
        capturedListener = undefined;
      };
    });
});

test('renders nothing when no notification has been pushed', () => {
  const { container } = render(<ToastHost />);

  expect(container).toBeEmptyDOMElement();
});

test('shows a toast with the notification title and message when one is pushed', () => {
  render(<ToastHost />);

  expect(capturedListener).toBeInstanceOf(Function);
  act(() => {
    capturedListener?.(TOAST_NOTIFICATION);
  });

  const toast = screen.getByRole('status');
  expect(toast).toBeInTheDocument();
  expect(screen.getByText('Новое сообщение')).toBeInTheDocument();
  expect(screen.getByText('Ещё актуально?')).toBeInTheDocument();
});

test('auto-dismisses the toast after 5000ms', async () => {
  vi.useFakeTimers();
  render(<ToastHost />);
  act(() => {
    capturedListener?.(TOAST_NOTIFICATION);
  });

  expect(screen.getByRole('status')).toBeInTheDocument();

  await vi.advanceTimersByTimeAsync(5000);

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  vi.useRealTimers();
});

test('clicking the dismiss button removes the toast before the auto-dismiss timer fires', async () => {
  const user = userEvent.setup();
  render(<ToastHost />);
  act(() => {
    capturedListener?.(TOAST_NOTIFICATION);
  });

  await user.click(screen.getByRole('button', { name: 'Закрыть' }));

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
