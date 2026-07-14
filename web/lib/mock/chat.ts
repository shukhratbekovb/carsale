import { CURRENT_BUYER_ID, type ChatMessage, type ChatThread } from '@/types/chat';

// Мок замена WebSocket Hub + Chat Module (docs/analysis/09-architecture.md,
// REST-фасад из docs/analysis/06-sequence-diagrams.md §6.4:
// GET /chat/threads?listing_id&buyer_id, POST /chat/threads/{id}/messages,
// WS-событие "new_message") до готовности Core API.

const MIN_LATENCY_MS = 300;
const MAX_LATENCY_MS = 700;

function mockLatency(): Promise<void> {
  const delay = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// In-memory «база» тредов/сообщений — переживает навигацию между /chat и
// /chat/[threadId] в рамках вкладки (module-level state), но не перезагрузку
// страницы: это мок REST+WS-хранилища на сервере, не клиентская персистентность.
const threads = new Map<string, ChatThread>();
const messagesByThread = new Map<string, ChatMessage[]>();

function seedThread(thread: ChatThread, messages: Array<Omit<ChatMessage, 'threadId'>>) {
  threads.set(thread.id, thread);
  messagesByThread.set(
    thread.id,
    messages.map((message) => ({ ...message, threadId: thread.id }))
  );
}

seedThread(
  {
    id: 'thread-1',
    listingId: '1',
    listingTitle: 'Chevrolet Cobalt, 2019',
    sellerId: 'seller-1',
    sellerName: 'Baxtiyor',
    lastMessageAt: '2026-07-10T14:32:00Z',
    lastMessagePreview: 'Да, машина ещё в продаже',
    unreadCount: 1,
  },
  [
    {
      id: 'msg-1-1',
      senderId: CURRENT_BUYER_ID,
      text: 'Здравствуйте! Машина ещё продаётся?',
      sentAt: '2026-07-10T14:30:00Z',
      status: 'SENT',
    },
    {
      id: 'msg-1-2',
      senderId: 'seller-1',
      text: 'Да, машина ещё в продаже',
      sentAt: '2026-07-10T14:32:00Z',
      status: 'SENT',
    },
  ]
);

seedThread(
  {
    id: 'thread-6',
    listingId: '6',
    listingTitle: 'Toyota Camry, 2018',
    sellerId: 'seller-6',
    sellerName: 'Nodira',
    lastMessageAt: '2026-07-08T10:05:00Z',
    lastMessagePreview: 'Хорошо, договорились',
    unreadCount: 0,
  },
  [
    {
      id: 'msg-6-1',
      senderId: CURRENT_BUYER_ID,
      text: 'Торг уместен?',
      sentAt: '2026-07-08T09:58:00Z',
      status: 'SENT',
    },
    {
      id: 'msg-6-2',
      senderId: 'seller-6',
      text: 'Небольшой, до 2 млн',
      sentAt: '2026-07-08T10:02:00Z',
      status: 'SENT',
    },
    {
      id: 'msg-6-3',
      senderId: CURRENT_BUYER_ID,
      text: 'Хорошо, договорились',
      sentAt: '2026-07-08T10:05:00Z',
      status: 'SENT',
    },
  ]
);

const SELLER_DIRECTORY: Record<string, { sellerId: string; sellerName: string; listingTitle: string }> = {
  '1': { sellerId: 'seller-1', sellerName: 'Baxtiyor', listingTitle: 'Chevrolet Cobalt, 2019' },
  '4': { sellerId: 'seller-4', sellerName: 'Sardor', listingTitle: 'Chevrolet Spark, 2017' },
  '6': { sellerId: 'seller-6', sellerName: 'Nodira', listingTitle: 'Toyota Camry, 2018' },
};

// Канонические ответы «продавца» — не случайные, а по индексу сообщения в
// треде: воспроизводимо для живой проверки и тестов (тот же принцип, что
// у детерминированной price-estimate).
const SELLER_REPLIES = [
  'Да, ещё в продаже.',
  'Могу показать сегодня вечером.',
  'Торг небольшой, в пределах разумного.',
  'Все документы в порядке, вопросов нет.',
  'Спасибо за интерес, напишу вам адрес.',
];

type MessageListener = (message: ChatMessage) => void;

const listeners = new Map<string, Set<MessageListener>>();

// Подписка на новые сообщения треда — аналог входа в WS-комнату треда.
// Возвращает unsubscribe (вызывается при размонтировании ChatWindow).
export function subscribeToThread(threadId: string, listener: MessageListener): () => void {
  const set = listeners.get(threadId) ?? new Set<MessageListener>();
  set.add(listener);
  listeners.set(threadId, set);
  return () => {
    set.delete(listener);
  };
}

function emitToThread(threadId: string, message: ChatMessage) {
  listeners.get(threadId)?.forEach((listener) => listener(message));
}

export async function mockFetchThreads(): Promise<ChatThread[]> {
  await mockLatency();
  return [...threads.values()].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export async function mockFetchThread(threadId: string): Promise<ChatThread | undefined> {
  await mockLatency();
  return threads.get(threadId);
}

export async function mockFetchMessages(threadId: string): Promise<ChatMessage[]> {
  await mockLatency();
  return messagesByThread.get(threadId) ?? [];
}

// UC-06 основной поток: «найти/создать ChatThread» при клике «Написать
// продавцу» с карточки объявления. Уникален по (listingId, buyerId) —
// повторный вызов для того же объявления возвращает существующий тред.
export async function mockFindOrCreateThread(listingId: string): Promise<ChatThread> {
  await mockLatency();

  const existing = [...threads.values()].find((thread) => thread.listingId === listingId);
  if (existing) return existing;

  const info = SELLER_DIRECTORY[listingId];
  const seller = info ?? {
    sellerId: `seller-${listingId}`,
    sellerName: 'Продавец',
    listingTitle: `Объявление #${listingId}`,
  };

  const thread: ChatThread = {
    id: `thread-${listingId}`,
    listingId,
    listingTitle: seller.listingTitle,
    sellerId: seller.sellerId,
    sellerName: seller.sellerName,
    lastMessageAt: new Date(0).toISOString(),
    lastMessagePreview: '',
    unreadCount: 0,
  };
  threads.set(thread.id, thread);
  messagesByThread.set(thread.id, []);
  return thread;
}

// Отправка сообщения (аналог POST /chat/threads/{id}/messages, FR-12 AC:
// доставка ≤3 сек). После подтверждения планирует авто-ответ «продавца»
// через emitToThread — демонстрирует реальный push новых сообщений в открытый
// ChatWindow без второго живого пользователя.
export async function mockSendMessage(threadId: string, text: string): Promise<ChatMessage> {
  await mockLatency();

  const message: ChatMessage = {
    id: `msg-${threadId}-${crypto.randomUUID()}`,
    threadId,
    senderId: CURRENT_BUYER_ID,
    text,
    sentAt: new Date().toISOString(),
    status: 'SENT',
  };

  const existing = messagesByThread.get(threadId) ?? [];
  const updated = [...existing, message];
  messagesByThread.set(threadId, updated);

  const thread = threads.get(threadId);
  if (thread) {
    threads.set(threadId, { ...thread, lastMessageAt: message.sentAt, lastMessagePreview: text });
  }

  scheduleSellerReply(threadId, updated.length);

  return message;
}

function scheduleSellerReply(threadId: string, messageIndex: number) {
  const thread = threads.get(threadId);
  if (!thread) return;

  const replyDelayMs = 1200 + Math.random() * 1500;
  setTimeout(() => {
    const reply: ChatMessage = {
      id: `msg-${threadId}-${crypto.randomUUID()}`,
      threadId,
      senderId: thread.sellerId,
      text: SELLER_REPLIES[messageIndex % SELLER_REPLIES.length],
      sentAt: new Date().toISOString(),
      status: 'SENT',
    };

    const existing = messagesByThread.get(threadId) ?? [];
    messagesByThread.set(threadId, [...existing, reply]);

    const current = threads.get(threadId);
    if (current) {
      threads.set(threadId, {
        ...current,
        lastMessageAt: reply.sentAt,
        lastMessagePreview: reply.text,
        unreadCount: current.unreadCount + 1,
      });
    }

    emitToThread(threadId, reply);
  }, replyDelayMs);
}

export async function mockMarkThreadRead(threadId: string): Promise<void> {
  const thread = threads.get(threadId);
  if (thread) {
    threads.set(threadId, { ...thread, unreadCount: 0 });
  }
}
