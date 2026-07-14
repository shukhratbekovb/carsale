import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type AppNotification,
  type NotificationPreferences,
  type NotificationType,
} from '@/types/notification';

// Мок уведомлений (FE-7, FR-11) — тот же паттерн, что lib/mock/chat.ts:
// in-memory лента + pub/sub для реал-тайм push (NotificationBell и
// ToastHost — оба просто подписчики одной и той же ленты, без дублирования
// логики между «постоянным списком» и «всплывающим тостом»).

const PREFERENCES_STORAGE_KEY = 'carsale:notification-preferences';

// Настройки читаются/пишутся напрямую через localStorage (не React-хук):
// pushNotification вызывается из других мок-модулей (chat.ts, sell-wizard),
// не из компонентов — там нет react-контекста для хука. UI-хук
// useNotificationPreferences (hooks/) читает тот же ключ через useLocalStorage
// для реактивности в самой форме настроек.
function readPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return raw
      ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) }
      : DEFAULT_NOTIFICATION_PREFERENCES;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

let notifications: AppNotification[] = [];

type Listener = (notification: AppNotification) => void;
const listeners = new Set<Listener>();

export function subscribeToNotifications(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function mockFetchNotifications(): Promise<AppNotification[]> {
  return notifications;
}

export function markNotificationRead(id: string): void {
  notifications = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
}

export function markAllNotificationsRead(): void {
  notifications = notifications.map((n) => ({ ...n, isRead: true }));
}

// Вызывается из других мок-модулей при демонстрационных событиях (новый ответ
// в чате, избранное объявление «подешевело», объявление ушло на модерацию).
// Уважает per-type настройку — если тип отключён, уведомление не создаётся
// вообще (не «создано, но скрыто»), соответствует FR-11 AC буквально.
export function pushNotification(
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): AppNotification | null {
  if (!readPreferences()[type]) return null;

  const notification: AppNotification = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    link,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  notifications = [notification, ...notifications];
  listeners.forEach((listener) => listener(notification));
  return notification;
}

// Демо-триггер снижения цены на избранное объявление — вызывается из
// FavoriteButton при добавлении в избранное (симулирует «поймали» алерт цены
// через какое-то время после наблюдения за объявлением, а не мгновенно).
// title/message приходят уже переведёнными от вызывающего компонента —
// у этого модуля нет доступа к useTranslations (не React-контекст).
export function schedulePriceDropDemo(title: string, message: string, link: string): void {
  const delayMs = 4000 + Math.random() * 3000;
  setTimeout(() => {
    pushNotification('PRICE_DROP', title, message, link);
  }, delayMs);
}
