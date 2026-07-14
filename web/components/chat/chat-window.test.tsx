import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/src/test/utils';
import { ChatWindow } from './chat-window';
import type { ChatMessage, ChatThread } from '@/types/chat';

const online = vi.hoisted(() => ({ value: true }));
const chat = vi.hoisted(() => ({
  mockFetchThread: vi.fn(),
  mockFetchMessages: vi.fn(),
  mockMarkThreadRead: vi.fn(),
  mockSendMessage: vi.fn(),
  subscribeToThread: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={typeof href === 'string' ? href : undefined} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/hooks/use-online-status', () => ({
  useOnlineStatus: () => online.value,
}));

vi.mock('@/lib/mock/chat', () => ({
  mockFetchThread: chat.mockFetchThread,
  mockFetchMessages: chat.mockFetchMessages,
  mockMarkThreadRead: chat.mockMarkThreadRead,
  mockSendMessage: chat.mockSendMessage,
  subscribeToThread: chat.subscribeToThread,
}));

const THREAD: ChatThread = {
  id: 'thread-1',
  listingId: '1',
  listingTitle: 'Chevrolet Cobalt, 2019',
  sellerId: 'seller-1',
  sellerName: 'Baxtiyor',
  lastMessageAt: '2026-07-10T14:32:00Z',
  lastMessagePreview: 'Да, машина ещё в продаже',
  unreadCount: 1,
};

const HISTORY: ChatMessage[] = [
  {
    id: 'msg-1',
    threadId: 'thread-1',
    senderId: 'seller-1',
    text: 'Здравствуйте!',
    sentAt: '2026-07-10T14:30:00Z',
    status: 'SENT',
  },
];

let capturedListener: ((message: ChatMessage) => void) | undefined;

beforeEach(() => {
  online.value = true;
  capturedListener = undefined;
  chat.mockFetchThread.mockReset();
  chat.mockFetchMessages.mockReset();
  chat.mockMarkThreadRead.mockReset().mockResolvedValue(undefined);
  chat.mockSendMessage.mockReset();
  chat.subscribeToThread.mockReset().mockImplementation((_threadId: string, listener: (message: ChatMessage) => void) => {
    capturedListener = listener;
    return () => {
      capturedListener = undefined;
    };
  });
});

test('shows a loading state before the thread resolves', () => {
  chat.mockFetchThread.mockReturnValue(new Promise(() => {}));
  chat.mockFetchMessages.mockReturnValue(new Promise(() => {}));
  render(<ChatWindow threadId="thread-1" />);

  expect(screen.getByText('Загружаем переписку...')).toBeInTheDocument();
});

test('shows a not-found state with a link back to the inbox for an unknown thread', async () => {
  chat.mockFetchThread.mockResolvedValue(undefined);
  chat.mockFetchMessages.mockResolvedValue([]);
  render(<ChatWindow threadId="does-not-exist" />);

  expect(await screen.findByText('Переписка не найдена')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Все переписки' })).toHaveAttribute('href', '/chat');
});

test('renders the thread header and message history once loaded', async () => {
  chat.mockFetchThread.mockResolvedValue(THREAD);
  chat.mockFetchMessages.mockResolvedValue(HISTORY);
  render(<ChatWindow threadId="thread-1" />);

  expect(await screen.findByText('Baxtiyor')).toBeInTheDocument();
  expect(screen.getByText('Chevrolet Cobalt, 2019')).toBeInTheDocument();
  expect(screen.getByText('Здравствуйте!')).toBeInTheDocument();
  expect(chat.mockMarkThreadRead).toHaveBeenCalledWith('thread-1');
});

test('sending a message while online queues it as PENDING and reconciles it to SENT', async () => {
  chat.mockFetchThread.mockResolvedValue(THREAD);
  chat.mockFetchMessages.mockResolvedValue(HISTORY);
  let resolveSend!: (message: ChatMessage) => void;
  chat.mockSendMessage.mockReturnValue(
    new Promise((resolve) => {
      resolveSend = resolve;
    })
  );

  const user = userEvent.setup();
  render(<ChatWindow threadId="thread-1" />);
  await screen.findByText('Baxtiyor');

  await user.type(screen.getByPlaceholderText('Напишите сообщение...'), 'Ещё актуально?');
  await user.click(screen.getByRole('button', { name: 'Отправить' }));

  expect(await screen.findByText('Ещё актуально?')).toBeInTheDocument();
  expect(screen.getByText('Отправка...')).toBeInTheDocument();
  expect(chat.mockSendMessage).toHaveBeenCalledWith('thread-1', 'Ещё актуально?');

  resolveSend({
    id: 'msg-server-1',
    threadId: 'thread-1',
    senderId: 'demo-buyer',
    text: 'Ещё актуально?',
    sentAt: '2026-07-10T15:00:00Z',
    status: 'SENT',
  });

  await waitFor(() => expect(screen.queryByText('Отправка...')).not.toBeInTheDocument());
});

test('sending a message while offline keeps it PENDING and never calls mockSendMessage', async () => {
  online.value = false;
  chat.mockFetchThread.mockResolvedValue(THREAD);
  chat.mockFetchMessages.mockResolvedValue(HISTORY);

  const user = userEvent.setup();
  render(<ChatWindow threadId="thread-1" />);
  await screen.findByText('Baxtiyor');

  expect(screen.getByText('Нет соединения — сообщения будут отправлены, когда связь восстановится')).toBeInTheDocument();

  await user.type(screen.getByPlaceholderText('Напишите сообщение...'), 'Сообщение в офлайне');
  await user.click(screen.getByRole('button', { name: 'Отправить' }));

  expect(await screen.findByText('Сообщение в офлайне')).toBeInTheDocument();
  expect(screen.getByText('Отправка...')).toBeInTheDocument();
  expect(chat.mockSendMessage).not.toHaveBeenCalled();
});

test('delivers an incoming message pushed through the thread subscription', async () => {
  chat.mockFetchThread.mockResolvedValue(THREAD);
  chat.mockFetchMessages.mockResolvedValue(HISTORY);
  render(<ChatWindow threadId="thread-1" />);
  await screen.findByText('Baxtiyor');

  expect(capturedListener).toBeInstanceOf(Function);
  capturedListener?.({
    id: 'msg-reply-1',
    threadId: 'thread-1',
    senderId: 'seller-1',
    text: 'Могу показать сегодня вечером.',
    sentAt: '2026-07-10T15:05:00Z',
    status: 'SENT',
  });

  expect(await screen.findByText('Могу показать сегодня вечером.')).toBeInTheDocument();
});
