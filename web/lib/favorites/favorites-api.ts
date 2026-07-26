import { authorizedFetch } from '@/lib/auth/authorized-fetch';
import type { Listing } from '@/types/listing';

// Клиент избранного (FR-13) — серверное хранение вместо device-local. Все вызовы
// авторизованы (Bearer + авто-refresh на 401). Контракт = Core /favorites.

export async function fetchFavoriteIds(): Promise<string[]> {
  const res = await authorizedFetch<{ ids: string[] }>('/favorites/ids');
  return res.ids;
}

export async function fetchFavorites(): Promise<Listing[]> {
  const res = await authorizedFetch<{ items: Listing[] }>('/favorites');
  return res.items;
}

export async function addFavorite(listingId: string): Promise<void> {
  await authorizedFetch(`/favorites/${listingId}`, { method: 'POST' });
}

export async function removeFavorite(listingId: string): Promise<void> {
  await authorizedFetch(`/favorites/${listingId}`, { method: 'DELETE' });
}
