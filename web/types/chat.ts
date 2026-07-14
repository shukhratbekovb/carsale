// Типы чата (FE-5, UC-06, docs/analysis/03-use-case-model.md:229-260).
// Упрощены относительно CHAT_THREAD/MESSAGE из docs/analysis/08-data-model.md —
// добавлены display-поля (sellerName, listingTitle, lastMessagePreview), которые
// в реальном API пришли бы JOIN'ом с USER/LISTING, а не хранятся в самих
// таблицах чата.

// Нет реальной сессии/JWT (см. HANDOFF.md) — фиксированный demo-профиль
// покупателя вместо настоящего auth.uid(), тем же способом, что OTP-флоу
// не хранит реальную сессию после мок-успеха.
export const CURRENT_BUYER_ID = 'demo-buyer';

export interface ChatThread {
  id: string;
  listingId: string;
  listingTitle: string;
  sellerId: string;
  sellerName: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
}

// PENDING — сообщение создано локально, ждёт отправки (офлайн-очередь,
// UC-06 alt-flow 5b: «сеть недоступна → сообщение в очереди, отправляется
// при восстановлении»). SENT — подтверждено моком «сервера» (аналог
// WS-события new_message / REST 201 из docs/analysis/06-sequence-diagrams.md §6.4).
export type MessageStatus = 'PENDING' | 'SENT';

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  sentAt: string;
  status: MessageStatus;
}
