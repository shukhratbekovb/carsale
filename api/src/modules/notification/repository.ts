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

// --- Доставка email/push (BE-7.2/7.3) ---

/** Email пользователя (для email-канала); null если не задан или удалён. */
export async function getUserEmail(userId: string): Promise<string | null> {
  const row = await getPrisma().user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { email: true },
  });
  return row?.email ?? null;
}

export interface PushSubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function listPushSubscriptions(userId: string): Promise<PushSubRow[]> {
  return getPrisma().pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
}

/** upsert по endpoint: повторная подписка того же устройства не плодит дубли. */
export async function savePushSubscription(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string,
): Promise<void> {
  await getPrisma().pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth },
    update: { userId, p256dh, auth },
  });
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await getPrisma().pushSubscription.deleteMany({ where: { endpoint } });
}
