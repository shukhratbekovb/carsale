import { AppError } from '../../lib/errors.js';
import { notify } from '../notification/service.js';
import {
  createMessage,
  getThreadParticipants,
  createThread,
  findThreadByListingBuyer,
  getPublishedListingSeller,
  getThreadIfParticipant,
  isParticipant,
  listMessages,
  listThreadsForUser,
  markThreadRead,
  type MessageRow,
  type ThreadRow,
} from './repository.js';

/**
 * Chat-сервис (BE-5.1/5.4, §6.4). Тред уникален по (listingId, buyerId); покупатель =
 * инициатор, продавец = владелец объявления. Real-time доставка (WS Hub) — BE-5.2/5.3.
 *
 * ПРОБЕЛ ДАННЫХ: USER не имеет поля имени (08-data-model минимизирует PII; имя даёт
 * OneID в P1), поэтому sellerName — плейсхолдер. Заполнится с профилем/OneID.
 */

const SELLER_NAME_PLACEHOLDER = 'Продавец';

export interface ThreadDto {
  id: string;
  listingId: string | null;
  listingTitle: string;
  sellerId: string;
  sellerName: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
}

export interface MessageDto {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  sentAt: string;
  status: 'SENT';
}

function toThreadDto(row: ThreadRow): ThreadDto {
  const v = row.listing?.vehicle;
  const listingTitle = v ? `${v.make} ${v.model}, ${v.year}` : 'Объявление';
  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle,
    sellerId: row.sellerId,
    sellerName: SELLER_NAME_PLACEHOLDER,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? '',
    lastMessagePreview: row.messages[0]?.text ?? '',
    unreadCount: row._count.messages,
  };
}

/**
 * Хук real-time доставки (BE-5.3). Транспорт (WS Hub) регистрирует эмиттер через
 * setMessageEmitter при старте сервера; сервис не зависит от socket.io напрямую
 * (инверсия зависимости — иначе тяжёлый socket.io тянется в граф каждого теста).
 */
type MessageEmitter = (threadId: string, message: MessageDto) => void;
let emitter: MessageEmitter | null = null;
export function setMessageEmitter(fn: MessageEmitter): void {
  emitter = fn;
}

function toMessageDto(row: MessageRow): MessageDto {
  return {
    id: row.id,
    threadId: row.threadId,
    senderId: row.senderId,
    text: row.text,
    sentAt: row.sentAt.toISOString(),
    status: 'SENT',
  };
}

export async function findOrCreateThread(
  userId: string,
  listingId: string,
): Promise<{ thread: ThreadDto; created: boolean }> {
  const listing = await getPublishedListingSeller(listingId);
  if (!listing) throw new AppError(404, 'listing_not_found', 'Listing not found or not published');
  if (listing.sellerId === userId) {
    throw new AppError(400, 'cannot_chat_with_self', 'Cannot start a chat on your own listing');
  }

  const existing = await findThreadByListingBuyer(listingId, userId, userId);
  if (existing) return { thread: toThreadDto(existing), created: false };

  const created = await createThread(listingId, userId, listing.sellerId, userId);
  return { thread: toThreadDto(created), created: true };
}

export async function listThreads(userId: string): Promise<ThreadDto[]> {
  const rows = await listThreadsForUser(userId);
  return rows.map(toThreadDto);
}

export async function getThread(threadId: string, userId: string): Promise<ThreadDto> {
  const row = await getThreadIfParticipant(threadId, userId);
  if (!row) throw new AppError(404, 'thread_not_found', 'Thread not found');
  return toThreadDto(row);
}

async function assertParticipant(threadId: string, userId: string): Promise<void> {
  if (!(await isParticipant(threadId, userId))) {
    throw new AppError(404, 'thread_not_found', 'Thread not found');
  }
}

export async function getMessages(threadId: string, userId: string): Promise<MessageDto[]> {
  await assertParticipant(threadId, userId);
  const rows = await listMessages(threadId);
  return rows.map(toMessageDto);
}

export async function sendMessage(
  threadId: string,
  userId: string,
  text: string,
): Promise<MessageDto> {
  await assertParticipant(threadId, userId);
  const row = await createMessage(threadId, userId, text);
  const dto = toMessageDto(row);
  // Real-time push участникам комнаты треда (BE-5.3); no-op в REST-only/тестах
  emitter?.(threadId, dto);
  // Уведомление получателю (BE-7 / офлайн-путь BE-5.3): персист + would-be email/push
  const parts = await getThreadParticipants(threadId);
  if (parts) {
    const recipient = parts.buyerId === userId ? parts.sellerId : parts.buyerId;
    await notify(recipient, 'NEW_MESSAGE', {
      title: 'Новое сообщение',
      message: text.length > 80 ? `${text.slice(0, 80)}…` : text,
      link: `/chat/${threadId}`,
    });
  }
  return dto;
}

export async function markRead(threadId: string, userId: string): Promise<void> {
  await assertParticipant(threadId, userId);
  await markThreadRead(threadId, userId);
}
