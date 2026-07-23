import type { Prisma } from '@prisma/client';
import { getPrisma } from '../../lib/prisma.js';

/** Доступ к чату (BE-5.1/5.4). Треды/сообщения; unread считается для конкретного зрителя. */

// Тред + данные для превью/непрочитанного относительно userId
export const threadSelect = (userId: string) =>
  ({
    id: true,
    listingId: true,
    buyerId: true,
    sellerId: true,
    lastMessageAt: true,
    listing: { select: { vehicle: { select: { make: true, model: true, year: true } } } },
    messages: { orderBy: { sentAt: 'desc' }, take: 1, select: { text: true } },
    _count: {
      select: { messages: { where: { isRead: false, senderId: { not: userId } } } },
    },
  }) satisfies Prisma.ChatThreadSelect;

export type ThreadRow = Prisma.ChatThreadGetPayload<{ select: ReturnType<typeof threadSelect> }>;

export async function findThreadByListingBuyer(
  listingId: string,
  buyerId: string,
  userId: string,
): Promise<ThreadRow | null> {
  return getPrisma().chatThread.findUnique({
    where: { listingId_buyerId: { listingId, buyerId } },
    select: threadSelect(userId),
  });
}

export async function getPublishedListingSeller(
  listingId: string,
): Promise<{ sellerId: string } | null> {
  return getPrisma().listing.findFirst({
    where: { id: listingId, status: 'PUBLISHED' },
    select: { sellerId: true },
  });
}

export async function createThread(
  listingId: string,
  buyerId: string,
  sellerId: string,
  userId: string,
): Promise<ThreadRow> {
  return getPrisma().chatThread.create({
    data: { listingId, buyerId, sellerId },
    select: threadSelect(userId),
  });
}

export async function listThreadsForUser(userId: string): Promise<ThreadRow[]> {
  return getPrisma().chatThread.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
    select: threadSelect(userId),
  });
}

export async function getThreadIfParticipant(
  threadId: string,
  userId: string,
): Promise<ThreadRow | null> {
  return getPrisma().chatThread.findFirst({
    where: { id: threadId, OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: threadSelect(userId),
  });
}

// Проверка участия без тяжёлого select (для messages/send/read)
export async function isParticipant(threadId: string, userId: string): Promise<boolean> {
  const row = await getPrisma().chatThread.findFirst({
    where: { id: threadId, OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: { id: true },
  });
  return row !== null;
}

export async function getThreadParticipants(
  threadId: string,
): Promise<{ buyerId: string; sellerId: string } | null> {
  return getPrisma().chatThread.findUnique({
    where: { id: threadId },
    select: { buyerId: true, sellerId: true },
  });
}

export const messageSelect = {
  id: true,
  threadId: true,
  senderId: true,
  text: true,
  sentAt: true,
} satisfies Prisma.MessageSelect;

export type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

export async function listMessages(threadId: string): Promise<MessageRow[]> {
  return getPrisma().message.findMany({
    where: { threadId },
    orderBy: { sentAt: 'asc' },
    select: messageSelect,
  });
}

/** Создаёт сообщение и двигает lastMessageAt треда в одной транзакции. */
export async function createMessage(
  threadId: string,
  senderId: string,
  text: string,
): Promise<MessageRow> {
  const prisma = getPrisma();
  const [message] = await prisma.$transaction([
    prisma.message.create({ data: { threadId, senderId, text }, select: messageSelect }),
    prisma.chatThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date() } }),
  ]);
  return message;
}

/** Помечает прочитанными все сообщения от собеседника (unread → 0 для зрителя). */
export async function markThreadRead(threadId: string, userId: string): Promise<void> {
  await getPrisma().message.updateMany({
    where: { threadId, senderId: { not: userId }, isRead: false },
    data: { isRead: true },
  });
}
