import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { AppError } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { createDraft, listMine, publish, updateDraft } from './service.js';
import { draftSchema, updateSchema } from './validation.js';

/**
 * Управление объявлениями продавца (BE-3.1/3.5). Все роуты требуют аутентификации;
 * владелец = текущий пользователь. Мутации монтируются на /listings (после каталога,
 * который перехватывает только GET); список своих — на /my (GET /listings под /listings
 * конфликтовал бы с каталожным GET /:id).
 */

const idSchema = z.string().uuid();

function listingId(raw: string): string {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) throw new AppError(404, 'listing_not_found', 'Listing not found');
  return parsed.data;
}

export const listingRouter = Router();

// POST /listings/draft — создать черновик (полные характеристики, §6.2)
listingRouter.post(
  '/draft',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = draftSchema.parse(req.body);
    const { id } = await createDraft(getAuth(res).sub, input);
    res.status(201).json({ id, status: 'DRAFT' });
  }),
);

// PUT /listings/:id — редактировать свой черновик (REJECTED → DRAFT)
listingRouter.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = listingId(req.params.id ?? '');
    const input = updateSchema.parse(req.body);
    await updateDraft(id, getAuth(res).sub, input);
    res.status(200).json({ id, updated: true });
  }),
);

// POST /listings/:id/publish — на модерацию + событие fraud_check (202, §6.2)
listingRouter.post(
  '/:id/publish',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = listingId(req.params.id ?? '');
    await publish(id, getAuth(res).sub);
    res.status(202).json({ status: 'pending_moderation' });
  }),
);

// GET /my/listings — объявления текущего продавца
export const myListingsRouter = Router();
myListingsRouter.get(
  '/listings',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const items = await listMine(getAuth(res).sub);
    res.json({ items });
  }),
);
