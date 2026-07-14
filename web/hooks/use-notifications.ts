import { useEffect, useState } from 'react';
import {
  markAllNotificationsRead,
  markNotificationRead,
  mockFetchNotifications,
  subscribeToNotifications,
} from '@/lib/mock/notifications';
import type { AppNotification } from '@/types/notification';

// Живая лента уведомлений — читает текущий список при монтировании и
// подписывается на push через subscribeToNotifications (аналог WS-push,
// тот же паттерн, что ChatWindow использует для входящих сообщений треда).
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    let cancelled = false;
    mockFetchNotifications().then((result) => {
      if (!cancelled) setNotifications(result);
    });

    const unsubscribe = subscribeToNotifications((notification) => {
      setNotifications((current) => [notification, ...current]);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  function markRead(id: string) {
    markNotificationRead(id);
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  function markAllRead() {
    markAllNotificationsRead();
    setNotifications((current) => current.map((n) => ({ ...n, isRead: true })));
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return { notifications, unreadCount, markRead, markAllRead };
}
