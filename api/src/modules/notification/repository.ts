import type { NotificationType, Prisma } from '@prisma/client';
import { getPrisma } from '../../lib/prisma.js';

/** Доступ к уведомлениям и per-type настройкам (BE-7). */

export const notificationSelect = {
  id: true,
  type: true,
  payload: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: Prisma.InputJsonValue,
): Promise<NotificationRow> {
  return getPrisma().notification.create({
    // in-app доставляется сразу; email/push-каналы добавит реальный адаптер
    data: { userId, type, channel: 'in_app', payload, delivered: true, deliveredAt: new Date() },
    select: notificationSelect,
  });
}

export async function listByUser(userId: string, limit = 50): Promise<NotificationRow[]> {
  return getPrisma().notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: notificationSelect,
  });
}

export async function countUnread(userId: string): Promise<number> {
  return getPrisma().notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string): Promise<void> {
  await getPrisma().notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Настройки уведомлений пользователя (JSON на User); null → все включены. */
export async function getUserPrefs(userId: string): Promise<Prisma.JsonValue | null> {
  const row = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });
  return row?.notificationPrefs ?? null;
}

export async function setUserPrefs(
  userId: string,
  prefs: Prisma.InputJsonValue,
): Promise<void> {
  await getPrisma().user.update({ where: { id: userId }, data: { notificationPrefs: prefs } });
}
