'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageBubble } from '@/components/chat/message-bubble';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { Link } from '@/i18n/navigation';
import {
  createInitialChatState,
  pendingMessages,
  queueLocalMessage,
  receiveMessage,
  reconcileSentMessage,
  setMessages,
  type ChatWindowState,
} from '@/lib/chat/chat-flow';
import {
  mockFetchMessages,
  mockFetchThread,
  mockMarkThreadRead,
  mockSendMessage,
  subscribeToThread,
} from '@/lib/mock/chat';
import type { ChatMessage, ChatThread } from '@/types/chat';

type ChatAction =
  | { type: 'SET_MESSAGES'; messages: ChatMessage[] }
  | { type: 'QUEUE_LOCAL'; localId: string; threadId: string; text: string }
  | { type: 'RECONCILE_SENT'; localId: string; confirmed: ChatMessage }
  | { type: 'RECEIVE'; message: ChatMessage };

function chatReducer(state: ChatWindowState, action: ChatAction): ChatWindowState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return setMessages(action.messages);
    case 'QUEUE_LOCAL':
      return queueLocalMessage(state, action.localId, action.threadId, action.text);
    case 'RECONCILE_SENT':
      return reconcileSentMessage(state, action.localId, action.confirmed);
    case 'RECEIVE':
      return receiveMessage(state, action.message);
    default:
      return state;
  }
}

interface ChatWindowProps {
  threadId: string;
}

// undefined — тред ещё грузится, null — не найден (аналог notFound(), но
// клиентский: ChatWindow сам делает async-фетч, next/navigation.notFound()
// работает только в серверном рендере).
type ThreadLookup = ChatThread | null | undefined;

export function ChatWindow({ threadId }: ChatWindowProps) {
  const t = useTranslations('chat');
  const isOnline = useOnlineStatus();

  const [thread, setThread] = useState<ThreadLookup>(undefined);
  const [state, dispatch] = useReducer(chatReducer, undefined, () => createInitialChatState());
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const flushingRef = useRef(false);

  // Загрузка треда + истории сообщений при открытии; подписка на push новых
  // (аналог входа в WS-комнату треда, событие new_message).
  useEffect(() => {
    let cancelled = false;

    mockFetchThread(threadId).then((found) => {
      if (!cancelled) setThread(found ?? null);
    });

    mockFetchMessages(threadId).then((messages) => {
      if (!cancelled) dispatch({ type: 'SET_MESSAGES', messages });
    });

    mockMarkThreadRead(threadId);

    const unsubscribe = subscribeToThread(threadId, (message) => {
      dispatch({ type: 'RECEIVE', message });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [state.messages.length]);

  // Единственное место, которое реально шлёт PENDING-сообщения — и когда
  // пользователь только что отправил (уже онлайн), и при восстановлении сети
  // после офлайна (UC-06 alt-flow 5b). handleSend ниже только кладёт сообщение
  // в очередь через reducer, саму отправку не делает — иначе прямой вызов
  // из handleSend и этот эффект гонялись бы за одно и то же PENDING-сообщение.
  useEffect(() => {
    if (!isOnline || flushingRef.current) return;
    if (pendingMessages(state).length === 0) return;

    let cancelled = false;

    async function flush() {
      flushingRef.current = true;
      try {
        for (const message of pendingMessages(state)) {
          if (cancelled) return;
          const confirmed = await mockSendMessage(threadId, message.text);
          if (!cancelled) dispatch({ type: 'RECONCILE_SENT', localId: message.id, confirmed });
        }
      } finally {
        flushingRef.current = false;
      }
    }

    flush();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, state.messages, threadId]);

  function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setDraft('');
    dispatch({ type: 'QUEUE_LOCAL', localId: crypto.randomUUID(), threadId, text });
  }

  if (thread === undefined) {
    return <p className="text-sm text-muted-foreground">{t('loadingThread')}</p>;
  }

  if (thread === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">{t('threadNotFound')}</p>
        <Link href="/chat" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t('backToInbox')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-lg border">
      <div className="border-b p-4">
        <Link href="/chat" className="text-xs text-muted-foreground hover:text-foreground">
          {t('backToInbox')}
        </Link>
        <p className="font-semibold">{thread.sellerName}</p>
        <p className="text-sm text-muted-foreground">{thread.listingTitle}</p>
      </div>

      {!isOnline && (
        <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-800">{t('offlineBanner')}</div>
      )}

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {state.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t p-3">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('messagePlaceholder')}
          aria-label={t('messagePlaceholder')}
          maxLength={2000}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={!draft.trim()}>
          {t('send')}
        </Button>
      </form>
    </div>
  );
}
