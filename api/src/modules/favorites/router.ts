import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { AppError } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { addFavorite, getFavorites, removeFavorite } from './service.js';

/**
 * Favorites Module (FR-13). Все роуты — только текущий пользователь (requireAuth).
 * Серверная замена device-scope избранного фронта; список отдаётся публичной
 * проекцией каталога, чтобы UI переиспользовал карточки.
 */
export const favoritesRouter = Router();
favoritesRouter.use(requireAuth);

const uuidSchema = z.string().uuid();
function listingId(raw: string): string {
  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) throw new AppError(404, 'listing_not_found', 'Listing not found');
  return parsed.data;
}

// GET /favorites — избранные объявления текущего пользователя (PublicListing[])
favoritesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getFavorites(getAuth(res).sub));
  }),
);

// POST /favorites/:listingId — добавить (идемпотентно)
favoritesRouter.post(
  '/:listingId',
  asyncHandler(async (req, res) => {
    res.json(await addFavorite(getAuth(res).sub, listingId(req.params.listingId ?? '')));
  }),
);

// DELETE /favorites/:listingId — убрать (идемпотентно)
favoritesRouter.delete(
  '/:listingId',
  asyncHandler(async (req, res) => {
    res.json(await removeFavorite(getAuth(res).sub, listingId(req.params.listingId ?? '')));
  }),
);
