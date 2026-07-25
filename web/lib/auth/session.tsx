'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMe, logout as logoutApi, refreshSession } from '@/lib/auth/auth-api';
import type { SessionUser } from '@/types/session';

/**
 * Клиентская сессия (§5 интеграции). Access-токен живёт ТОЛЬКО в памяти (ref),
 * не в React-state и не в localStorage — не утекает в разметку/хранилище; при
 * перезагрузке восстанавливается из httpOnly refresh cookie (bootstrap ниже).
 * refresh_token браузер держит сам (same-origin cookie от BFF-прокси).
 */

type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

interface SessionContextValue {
  status: SessionStatus;
  user: SessionUser | null;
  /** Установить сессию после успешного verify (access в память, user в state). */
  login: (accessToken: string, user: SessionUser) => void;
  /** Выйти: инвалидировать refresh на сервере + очистить локально. */
  signOut: () => Promise<void>;
  /** Текущий access-токен для авторизованных вызовов (или null). */
  getAccessToken: () => string | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  const login = useCallback((accessToken: string, nextUser: SessionUser) => {
    accessTokenRef.current = accessToken;
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const clear = useCallback(() => {
    accessTokenRef.current = null;
    setUser(null);
    setStatus('anonymous');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // логаут идемпотентен — даже при сетевом сбое чистим локально
    }
    clear();
  }, [clear]);

  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  // Восстановление сессии при загрузке: refresh по cookie → /me. Нет cookie /
  // истёк refresh → анонимный (нормальный путь для гостя, не ошибка).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { accessToken } = await refreshSession();
        const me = await fetchMe(accessToken);
        if (cancelled) return;
        accessTokenRef.current = accessToken;
        setUser(me);
        setStatus('authenticated');
      } catch {
        if (!cancelled) clear();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clear]);

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, login, signOut, getAccessToken }),
    [status, user, login, signOut, getAccessToken],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
