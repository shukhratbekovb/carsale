'use client';

import { useId, useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useNotifications } from '@/hooks/use-notifications';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

// Real-time счётчик непрочитанных (frontend-plan.md §6: «NotificationBell |
// Client | Real-time счётчик непрочитанных»). Popover-паттерн — тот же, что
// LocationPicker уже использует в шапке.
export function NotificationBell() {
  const t = useTranslations('notifications');
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unreadCount > 0 ? t('unreadBadge', { count: unreadCount }) : t('bellLabel')}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border bg-background shadow-lg"
        >
          <div className="flex items-center justify-between border-b p-3">
            <span className="text-sm font-semibold">{t('bellLabel')}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t('markAllRead')}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{t('emptyTitle')}</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((notification) => {
                const content = (
                  <>
                    <p className={cn('text-sm', !notification.isRead && 'font-semibold')}>
                      {notification.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{notification.message}</p>
                  </>
                );

                return (
                  <li key={notification.id} className="border-b last:border-0">
                    {notification.link ? (
                      <Link
                        href={notification.link}
                        onClick={() => {
                          markRead(notification.id);
                          setOpen(false);
                        }}
                        className={cn('block p-3 hover:bg-accent', !notification.isRead && 'bg-accent/50')}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markRead(notification.id)}
                        className={cn(
                          'block w-full p-3 text-left hover:bg-accent',
                          !notification.isRead && 'bg-accent/50'
                        )}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block border-t p-3 text-center text-xs font-medium text-primary hover:underline"
          >
            {t('settingsLink')}
          </Link>
        </div>
      )}
    </div>
  );
}
