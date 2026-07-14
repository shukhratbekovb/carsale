import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationType } from '@/types/notification';

const PREFERENCES_STORAGE_KEY = 'carsale:notification-preferences';

// Тот же ключ, что lib/mock/notifications.ts читает напрямую через
// localStorage (там нет React-контекста для этого хука) — держим общий
// PREFERENCES_STORAGE_KEY в одном месте было бы чище, но модуль mock/
// не может импортировать хук (он не React), поэтому строка ключа продублирована
// намеренно; при изменении — менять в обоих местах.
export function useNotificationPreferences() {
  const [preferences, setPreferences] = useLocalStorage(
    PREFERENCES_STORAGE_KEY,
    DEFAULT_NOTIFICATION_PREFERENCES
  );

  const setPreference = useCallback(
    (type: NotificationType, enabled: boolean) => {
      setPreferences((current) => ({ ...current, [type]: enabled }));
    },
    [setPreferences]
  );

  return { preferences, setPreference };
}
