import type { NotificationType, Prisma } from '@prisma/client';
import { logger } from '../../lib/logger.js';
import { publishEvent } from '../../lib/queue.js';
import { env } from '../../config/env.js';
import {
  countUnread,
  createNotification,
  deletePushSubscription,
  getUserPrefs,
  listByUser,
  markAllRead as repoMarkAllRead,
  type NotificationRow,
  savePushSubscription,
  setUserPrefs,
} from './repository.js';
import type { PreferencesInput, PushSubscriptionInput } from './validation.js';

/**
 * Notification-сервис (BE-7, FR-11). Публичный интерфейс модуля: другие модули
 * зовут notify() (ADR-006). Три типа: NEW_MESSAGE / PRICE_DROP / LISTING_STATUS.
 *
 * Строки title/message/link строит ВЫЗЫВАЮЩИЙ (у него контекст и локаль) и передаёт
 * в payload — модуль их не хардкодит (тот же принцип, что во фронтовом моке).
 * Доставка сейчас только in-app (персист); email/push подключит реальный адаптер.
 */

export const NOTIFICATION_TYPES: NotificationType[] = [
  'NEW_MESSAGE',
  'PRICE_DROP',
  'LISTING_STATUS',
];

/** Очередь внешней доставки (email/push) — разбирается delivery-consumer (BE-7.2/7.3). */
export const NOTIFICATION_DELIVERY_QUEUE = 'notification_delivery';

export type NotificationPreferences = Record<NotificationType, boolean>;

const DEFAULT_PREFS: NotificationPreferences = {
  NEW_MESSAGE: true,
  PRICE_DROP: true,
  LISTING_STATUS: true,
};

export interface NotifyPayload {
  title: string;
  message: string;
  link?: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

function parsePrefs(stored: Prisma.JsonValue | null): NotificationPreferences {
  const result = { ...DEFAULT_PREFS };
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    for (const type of NOTIFICATION_TYPES) {
      const v = (stored as Record<string, unknown>)[type];
      if (typeof v === 'boolean') result[type] = v;
    }
  }
  return result;
}

function toAppNotification(row: NotificationRow): AppNotification {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    type: row.type,
    title: typeof p['title'] === 'string' ? p['title'] : '',
    message: typeof p['message'] === 'string' ? p['message'] : '',
    ...(typeof p['link'] === 'string' ? { link: p['link'] } : {}),
    isRead: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Отправить уведомление. Уважает per-type настройку буквально: тип отключён →
 * уведомление НЕ создаётся (как во фронтовом моке). Best-effort: сбой доставки
 * логируется, но не пробрасывается — продьюсер (чат/листинг) не должен падать.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  payload: NotifyPayload,
): Promise<void> {
  try {
    const prefs = parsePrefs(await getUserPrefs(userId));
    if (!prefs[type]) return; // тип отключён — не создаём

    const jsonPayload: Prisma.InputJsonValue = {
      title: payload.title,
      message: payload.message,
      ...(payload.link ? { link: payload.link } : {}),
    };
    await createNotification(userId, type, jsonPayload);
    logger.info({ userId, type }, 'notification delivered (in-app)');

    // Внешняя доставка (email/push) — асинхронно через очередь, чтобы продьюсер
    // (чат/листинг/платёж) не ждал внешний HTTP. Тип уже прошёл pref-гейт выше.
    // best-effort: без очереди in-app уже доставлено, доставку канала логируем.
    try {
      await publishEvent(NOTIFICATION_DELIVERY_QUEUE, {
        user_id: userId,
        type,
        title: payload.title,
        message: payload.message,
        ...(payload.link ? { link: payload.link } : {}),
      });
    } catch (err) {
      logger.warn({ err, userId, type }, 'notify: failed to enqueue external delivery');
    }
  } catch (err) {
    logger.warn({ err, userId, type }, 'notify failed (non-fatal)');
  }
}

export async function list(
  userId: string,
): Promise<{ items: AppNotification[]; unreadCount: number }> {
  const [rows, unreadCount] = await Promise.all([listByUser(userId), countUnread(userId)]);
  return { items: rows.map(toAppNotification), unreadCount };
}

export async function markAllRead(userId: string): Promise<void> {
  await repoMarkAllRead(userId);
}

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  return parsePrefs(await getUserPrefs(userId));
}

/** Публичный VAPID-ключ для подписки браузера (BE-7.3); null если push не настроен. */
export function getVapidPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}

/** Регистрация Web Push подписки браузера (BE-7.3). */
export async function subscribePush(
  userId: string,
  sub: PushSubscriptionInput,
): Promise<void> {
  await savePushSubscription(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
}

/** Отписка (endpoint устройства) — например, при отзыве разрешения в браузере. */
export async function unsubscribePush(endpoint: string): Promise<void> {
  await deletePushSubscription(endpoint);
}

export async function setPreferences(
  userId: string,
  prefs: PreferencesInput,
): Promise<NotificationPreferences> {
  await setUserPrefs(userId, prefs);
  return prefs;
}
