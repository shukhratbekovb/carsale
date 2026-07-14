'use client';

import { useTranslations } from 'next-intl';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';
import { NOTIFICATION_TYPE_VALUES, type NotificationType } from '@/types/notification';

const TYPE_LABEL_KEYS: Record<NotificationType, string> = {
  NEW_MESSAGE: 'typeNewMessage',
  PRICE_DROP: 'typePriceDrop',
  LISTING_STATUS: 'typeListingStatus',
};

// Per-type toggle настроек (FE-7, FR-11 AC: «пользователь может отключить
// каждый тип уведомлений отдельно»). Один toggle на тип, без разделения
// email/push — канал доставки решает backend, UI управляет только тем,
// приходит уведомление или нет (см. types/notification.ts).
export function NotificationPreferences() {
  const t = useTranslations('notifications');
  const { preferences, setPreference } = useNotificationPreferences();

  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold">{t('preferencesTitle')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('preferencesHint')}</p>

      <ul className="mt-4 flex flex-col divide-y">
        {NOTIFICATION_TYPE_VALUES.map((type) => (
          <li key={type} className="flex items-center justify-between gap-4 py-3">
            <label htmlFor={`pref-${type}`} className="text-sm">
              {t(TYPE_LABEL_KEYS[type])}
            </label>
            <input
              id={`pref-${type}`}
              type="checkbox"
              role="switch"
              aria-checked={preferences[type]}
              checked={preferences[type]}
              onChange={(event) => setPreference(type, event.target.checked)}
              className="h-5 w-9 shrink-0 appearance-none rounded-full bg-muted transition-colors checked:bg-primary relative cursor-pointer before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-background before:transition-transform checked:before:translate-x-4"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
