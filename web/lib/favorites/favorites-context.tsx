'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from '@/lib/auth/session';
import {
  addFavorite as apiAdd,
  fetchFavoriteIds,
  removeFavorite as apiRemove,
} from '@/lib/favorites/favorites-api';

/**
 * Общий стор избранного (FR-13). Один набор id на приложение — грузится один раз
 * при авторизации (иначе каждый «сердечко»-бейдж на карточках каталога бил бы по
 * `/favorites/ids` отдельно). Гость — пустой набор (кнопка ведёт на логин).
 * Тоггл оптимистичный: сразу меняем локально, при сбое API откатываем.
 */
interface FavoritesContextValue {
  isAuthenticated: boolean;
  isFavorite: (listingId: string) => boolean;
  toggleFavorite: (listingId: string) => void;
}

// Дефолт — «гость без избранного»: карточки рендерятся и без провайдера (SSR до
// гидратации, презентационные тесты). В приложении провайдер в layout переопределяет.
const FavoritesContext = createContext<FavoritesContextValue>({
  isAuthenticated: false,
  isFavorite: () => false,
  toggleFavorite: () => undefined,
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const [ids, setIds] = useState<Set<string>>(new Set());

  // Загрузка набора id при входе; на выходе/госте — очищаем
  useEffect(() => {
    if (!isAuthenticated) {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    fetchFavoriteIds()
      .then((list) => {
        if (!cancelled) setIds(new Set(list));
      })
      .catch(() => {
        if (!cancelled) setIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const isFavorite = useCallback((listingId: string) => ids.has(listingId), [ids]);

  const toggleFavorite = useCallback(
    (listingId: string) => {
      if (!isAuthenticated) return; // гостя перехватывает кнопка (редирект на логин)
      const wasFav = ids.has(listingId);
      setIds((cur) => {
        const next = new Set(cur);
        if (wasFav) next.delete(listingId);
        else next.add(listingId);
        return next;
      });
      (wasFav ? apiRemove(listingId) : apiAdd(listingId)).catch(() => {
        // откат оптимистичного изменения при сбое
        setIds((cur) => {
          const next = new Set(cur);
          if (wasFav) next.add(listingId);
          else next.delete(listingId);
          return next;
        });
      });
    },
    [ids, isAuthenticated],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({ isAuthenticated, isFavorite, toggleFavorite }),
    [isAuthenticated, isFavorite, toggleFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  return useContext(FavoritesContext);
}
