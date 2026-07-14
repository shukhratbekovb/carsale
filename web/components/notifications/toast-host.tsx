'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { subscribeToNotifications } from '@/lib/mock/notifications';
import type { AppNotification } from '@/types/notification';

const AUTO_DISMISS_MS = 5000;

// Всплывающие тосты — независимый подписчик той же ленты уведомлений, что
// NotificationBell (pushNotification эмитит в оба разом, никакой отдельной
// «тост-шины» не заводим). Рендерится один раз в корневом layout.
export function ToastHost() {
  const t = useTranslations('notifications');
  const [toasts, setToasts] = useState<AppNotification[]>([]);

  useEffect(() => {
    return subscribeToNotifications((notification) => {
      setToasts((current) => [...current, notification]);
      setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== notification.id));
      }, AUTO_DISMISS_MS);
    });
  }, []);

  function dismiss(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-start gap-2 rounded-lg border bg-background p-3 shadow-lg"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{toast.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label={t('dismiss')}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
