import { AppError } from '../../lib/errors.js';
import { toPublicListing, type PublicListing } from '../catalog/mapper.js';
import {
  addFavorite as repoAdd,
  findPublishedListing,
  listFavoriteListings,
  removeFavorite as repoRemove,
} from './repository.js';

/**
 * Избранное (FR-13). Все вызовы — для текущего пользователя (auth в роутере).
 * Заменяет device-scope localStorage фронта серверным хранением (HANDOFF FE п.15).
 */

export async function getFavorites(userId: string): Promise<{ items: PublicListing[] }> {
  const rows = await listFavoriteListings(userId);
  return { items: rows.map(toPublicListing) };
}

export interface FavoriteResult {
  listingId: string;
  favorited: boolean;
}

/** Добавить в избранное. 404, если объявление не существует/не опубликовано. */
export async function addFavorite(userId: string, listingId: string): Promise<FavoriteResult> {
  const listing = await findPublishedListing(listingId);
  if (!listing) throw new AppError(404, 'listing_not_found', 'Listing not found');
  await repoAdd(userId, listingId);
  return { listingId, favorited: true };
}

/** Убрать из избранного (идемпотентно — 200 даже если не было). */
export async function removeFavorite(userId: string, listingId: string): Promise<FavoriteResult> {
  await repoRemove(userId, listingId);
  return { listingId, favorited: false };
}
