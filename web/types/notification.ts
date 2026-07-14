// Уведомления (FE-7, FR-11). Три типа — ровно то, что перечислено в PRD:
// «новое сообщение в чате, снижение цены на сохранённое авто, статус
// объявления». NOTIFICATION-сущность из docs/analysis/08-data-model.md
// хранит user_id/channel/payload/delivered — упрощено для фронтенда до
// того, что реально показывает bell/toast: title/message/link/isRead.

export type NotificationType = 'NEW_MESSAGE' | 'PRICE_DROP' | 'LISTING_STATUS';

export const NOTIFICATION_TYPE_VALUES = [
  'NEW_MESSAGE',
  'PRICE_DROP',
  'LISTING_STATUS',
] as const satisfies readonly NotificationType[];

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// «Пользователь может отключить каждый тип уведомлений отдельно» (FR-11 AC) —
// один toggle на тип, без отдельного канала email/push: канал — решение
// механизма доставки (backend), UI управляет только тем, приходит уведомление
// или нет, per-type.
export type NotificationPreferences = Record<NotificationType, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  NEW_MESSAGE: true,
  PRICE_DROP: true,
  LISTING_STATUS: true,
};
