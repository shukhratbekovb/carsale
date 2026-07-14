import { useCallback } from 'react';
import { useLocalStorage } from '@/hooks/use-local-storage';

const FAVORITES_STORAGE_KEY = 'carsale:favorites';

// Избранное как frontend-only фича поверх localStorage (FE-R, /favorites — P1,
// FR-13, frontend-plan.md §5) — тот же паттерн, что LocationPicker использует
// для города. «Сохраняется между сессиями» здесь означает «на этом устройстве»;
// синхронизация между устройствами придёт вместе с Core API/аккаунтом.
export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useLocalStorage<string[]>(FAVORITES_STORAGE_KEY, []);

  const isFavorite = useCallback((listingId: string) => favoriteIds.includes(listingId), [favoriteIds]);

  const toggleFavorite = useCallback(
    (listingId: string) => {
      setFavoriteIds((current) =>
        current.includes(listingId)
          ? current.filter((id) => id !== listingId)
          : [...current, listingId]
      );
    },
    [setFavoriteIds]
  );

  return { favoriteIds, isFavorite, toggleFavorite };
}
