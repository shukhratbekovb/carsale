import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/src/test/utils';
import { MessageSellerButton } from './message-seller-button';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
const chat = vi.hoisted(() => ({ mockFindOrCreateThread: vi.fn() }));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
}));

vi.mock('@/lib/mock/chat', () => ({
  mockFindOrCreateThread: chat.mockFindOrCreateThread,
}));

beforeEach(() => {
  nav.push.mockClear();
  chat.mockFindOrCreateThread.mockReset();
});

test('creates/finds the thread for the listing and navigates to it', async () => {
  chat.mockFindOrCreateThread.mockResolvedValue({ id: 'thread-1' });
  render(<MessageSellerButton listingId="1" />);

  await userEvent.click(screen.getByRole('button', { name: 'Написать продавцу' }));

  expect(chat.mockFindOrCreateThread).toHaveBeenCalledWith('1');
  await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/chat/thread-1'));
});

test('shows a starting-thread label while the request is in flight, then reverts', async () => {
  let resolveThread!: (value: { id: string }) => void;
  chat.mockFindOrCreateThread.mockReturnValue(
    new Promise((resolve) => {
      resolveThread = resolve;
    })
  );
  render(<MessageSellerButton listingId="1" />);

  await userEvent.click(screen.getByRole('button', { name: 'Написать продавцу' }));
  expect(screen.getByRole('button', { name: 'Открываем чат...' })).toBeDisabled();

  resolveThread({ id: 'thread-1' });
  await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/chat/thread-1'));
});
