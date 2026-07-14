import { render, screen, waitFor } from '@/src/test/utils';
import { ChatThreadList } from './chat-thread-list';
import type { ChatThread } from '@/types/chat';

const chat = vi.hoisted(() => ({ mockFetchThreads: vi.fn() }));

vi.mock('@/lib/mock/chat', () => ({
  mockFetchThreads: chat.mockFetchThreads,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

function makeThread(overrides: Partial<ChatThread> = {}): ChatThread {
  return {
    id: 'thread-1',
    listingId: '1',
    listingTitle: 'Chevrolet Cobalt, 2019',
    sellerId: 'seller-1',
    sellerName: 'Baxtiyor',
    lastMessageAt: '2026-07-10T14:32:00Z',
    lastMessagePreview: 'Да, машина ещё в продаже',
    unreadCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  chat.mockFetchThreads.mockReset();
});

test('shows the empty state with a link to the catalog when there are no threads', async () => {
  chat.mockFetchThreads.mockResolvedValue([]);
  render(<ChatThreadList />);

  expect(await screen.findByText('Пока нет переписок')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Смотреть каталог' })).toHaveAttribute('href', '/catalog');
});

test('renders every thread with seller name, listing title and preview', async () => {
  chat.mockFetchThreads.mockResolvedValue([
    makeThread({ id: 'thread-1', sellerName: 'Baxtiyor' }),
    makeThread({ id: 'thread-6', sellerName: 'Nodira', listingTitle: 'Toyota Camry, 2018' }),
  ]);
  render(<ChatThreadList />);

  expect(await screen.findByText('Baxtiyor')).toBeInTheDocument();
  expect(screen.getByText('Nodira')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Baxtiyor/ })).toHaveAttribute('href', '/chat/thread-1');
  expect(screen.getByRole('link', { name: /Nodira/ })).toHaveAttribute('href', '/chat/thread-6');
});

test('shows an unread badge only for threads with unreadCount > 0', async () => {
  chat.mockFetchThreads.mockResolvedValue([
    makeThread({ id: 'thread-1', sellerName: 'Baxtiyor', unreadCount: 2 }),
    makeThread({ id: 'thread-6', sellerName: 'Nodira', unreadCount: 0 }),
  ]);
  render(<ChatThreadList />);

  await waitFor(() => expect(screen.getByText('Baxtiyor')).toBeInTheDocument());

  expect(screen.getByLabelText('2')).toBeInTheDocument();
  expect(screen.queryByLabelText('0')).not.toBeInTheDocument();
});
