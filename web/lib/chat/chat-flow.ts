import { CURRENT_BUYER_ID, type ChatMessage } from '@/types/chat';

// Чистый reducer состояния одного открытого треда (ChatWindow) — тот же
// паттерн, что otp-flow.ts/wizard-flow.ts: reducer только переносит данные,
// вся асинхронность (fetch/WS-подписка/отправка) остаётся в компоненте.

export interface ChatWindowState {
  messages: ChatMessage[];
}

export function createInitialChatState(messages: ChatMessage[] = []): ChatWindowState {
  return { messages };
}

export function setMessages(messages: ChatMessage[]): ChatWindowState {
  return { messages };
}

// Оптимистичное локальное сообщение — офлайн-очередь (UC-06 alt-flow 5b:
// «сеть недоступна → сообщение ставится в очередь, отправляется при
// восстановлении»). id генерируется на клиенте, чтобы reconcileSentMessage
// мог найти и заменить его подтверждённым сообщением от mockSendMessage.
export function queueLocalMessage(
  state: ChatWindowState,
  localId: string,
  threadId: string,
  text: string
): ChatWindowState {
  const message: ChatMessage = {
    id: localId,
    threadId,
    senderId: CURRENT_BUYER_ID,
    text,
    sentAt: new Date().toISOString(),
    status: 'PENDING',
  };
  return { messages: [...state.messages, message] };
}

// Заменяет локальное PENDING-сообщение подтверждённым от mockSendMessage
// (другой id, серверный sentAt) — аналог того, как REST 201 подтверждает
// optimistic update в реальном клиенте.
export function reconcileSentMessage(
  state: ChatWindowState,
  localId: string,
  confirmed: ChatMessage
): ChatWindowState {
  return {
    messages: state.messages.map((message) => (message.id === localId ? confirmed : message)),
  };
}

// Входящее сообщение через subscribeToThread (аналог WS-события new_message).
// Дедуп по id: собственное отправленное сообщение может успеть прийти и
// синхронным ответом mockSendMessage, и через подписку.
export function receiveMessage(state: ChatWindowState, message: ChatMessage): ChatWindowState {
  if (state.messages.some((existing) => existing.id === message.id)) return state;
  return { messages: [...state.messages, message] };
}

export function pendingMessages(state: ChatWindowState): ChatMessage[] {
  return state.messages.filter((message) => message.status === 'PENDING');
}
