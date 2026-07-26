import { getPrisma } from '../../lib/prisma.js';
import { type PublicListingRow, publicListingSelect } from '../catalog/mapper.js';

/**
 * Доступ к избранному (FR-13). Favorite — m:n USER↔LISTING (@@id[userId,listingId]).
 * Список отдаётся публичной проекцией каталога (переиспользуем publicListingSelect/
 * toPublicListing — тот же приём, что admin BE-8), поэтому фронт рисует те же карточки.
 */

/** Избранные объявления пользователя — только PUBLISHED с vehicle, свежие сверху. */
export async function listFavoriteListings(userId: string): Promise<PublicListingRow[]> {
  const rows = await getPrisma().favorite.findMany({
    where: { userId, listing: { status: 'PUBLISHED', vehicle: { isNot: null } } },
    orderBy: { createdAt: 'desc' },
    select: { listing: { select: publicListingSelect } },
  });
  return rows.map((r) => r.listing);
}

/** Только id избранных объявлений (лёгкий вызов для состояния «сердечка» на карточках). */
export async function listFavoriteIds(userId: string): Promise<string[]> {
  const rows = await getPrisma().favorite.findMany({
    where: { userId },
    select: { listingId: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => r.listingId);
}

/** Идемпотентное добавление (повторное — no-op, без P2002). */
export async function addFavorite(userId: string, listingId: string): Promise<void> {
  await getPrisma().favorite.upsert({
    where: { userId_listingId: { userId, listingId } },
    create: { userId, listingId },
    update: {},
  });
}

/** Идемпотентное удаление (deleteMany не бросает при 0 строк). */
export async function removeFavorite(userId: string, listingId: string): Promise<void> {
  await getPrisma().favorite.deleteMany({ where: { userId, listingId } });
}

/** Существует ли PUBLISHED-объявление (валидация перед добавлением в избранное). */
export async function findPublishedListing(listingId: string): Promise<{ id: string } | null> {
  return getPrisma().listing.findFirst({
    where: { id: listingId, status: 'PUBLISHED' },
    select: { id: true },
  });
}
