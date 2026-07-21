import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { AppError } from '../../lib/errors.js';
import { toPublicListing } from './mapper.js';
import { findByIdPublic, findPublished, findSimilar } from './repository.js';
import { listQuerySchema } from './validation.js';

/**
 * Публичный каталог (BE-4, §6.6). Только GET; мутации продавца — в listing-модуле
 * (монтируется на тот же /listings следом). ML-флаги отдаются в том же ответе
 * (FR-07/NFR-2), VIN/госномер не выходят наружу (BR-3).
 */
export const catalogRouter = Router();

const idSchema = z.string().uuid();

// GET /listings — фильтры/сортировка/пагинация; при пустой выдаче добавляем similar
catalogRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const { items, total } = await findPublished(q);
    const body = {
      items: items.map(toPublicListing),
      total,
      page: q.page,
      page_size: q.pageSize,
    };
    if (total === 0) {
      const similar = await findSimilar(q);
      res.json({ ...body, similar: similar.map(toPublicListing) });
      return;
    }
    res.json(body);
  }),
);

// GET /listings/:id — публичная карточка
catalogRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const parsed = idSchema.safeParse(req.params.id);
    if (!parsed.success) throw new AppError(404, 'listing_not_found', 'Listing not found');
    const row = await findByIdPublic(parsed.data);
    if (!row) throw new AppError(404, 'listing_not_found', 'Listing not found');
    res.json(toPublicListing(row));
  }),
);
