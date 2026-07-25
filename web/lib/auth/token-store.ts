// Разделяемое хранилище access-токена (§5). Токен живёт в модульной переменной
// (в памяти вкладки), а не в React-state/localStorage — им пользуются и
// SessionProvider (React), и authorizedFetch (обычный модуль вне React).
// Здесь же — дедуплицированный refresh: параллельные 401 дожидаются одного
// сетевого refresh, а не бьют по /auth/refresh пачкой.
import { refreshSession } from '@/lib/auth/auth-api';

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

interface SessionHooks {
  // Новый токен получен фоновым refresh (напр. после 401) — синхронизировать UI.
  onRefreshed?: (token: string) => void;
  // Refresh не удался (нет/истёк refresh cookie) — сессия потеряна, разлогинить UI.
  onAuthLost?: () => void;
}

let hooks: SessionHooks = {};

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** SessionProvider регистрирует реакции на фоновые события токена. */
export function registerSessionHooks(next: SessionHooks): void {
  hooks = next;
}

/**
 * Обновить access-токен по refresh cookie. Дедуплицировано: одновременные
 * вызовы разделяют один in-flight refresh. Успех → новый токен (+onRefreshed);
 * провал → null (+onAuthLost, токен сброшен).
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const { accessToken: token } = await refreshSession();
        accessToken = token;
        hooks.onRefreshed?.(token);
        return token;
      } catch {
        accessToken = null;
        hooks.onAuthLost?.();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}
