import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { AppError } from '../../lib/errors.js';
import type { BlurRegion } from '../../lib/ml-client.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { addPhoto, createDraft, estimatePrice, getPhotos, listMine, publish, updateDraft } from './service.js';
import { draftSchema, regionsSchema, updateSchema } from './validation.js';

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

// Загрузка фото (BE-3.3): в память (буфер уходит в ML blur, затем в MinIO),
// только изображения, лимит 10 МБ на файл.
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

// Опц. области ручной корректировки блюра из multipart-поля regions (JSON-строка).
function parseRegions(raw: unknown): BlurRegion[] | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(400, 'bad_regions', 'regions must be valid JSON');
  }
  return regionsSchema.parse(parsed);
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

// POST /listings/:id/price-estimate — Deal Rating от ML (§6.2); ML down → UNAVAILABLE
listingRouter.post(
  '/:id/price-estimate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = listingId(req.params.id ?? '');
    const estimate = await estimatePrice(id, getAuth(res).sub);
    res.json(estimate);
  }),
);

// POST /listings/:id/photos — загрузка фото (multipart): ML blur → MinIO (§6.2)
listingRouter.post(
  '/:id/photos',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const id = listingId(req.params.id ?? '');
    if (!req.file) throw new AppError(400, 'file_required', 'A photo file is required');
    const regions = parseRegions(req.body?.regions);
    const photo = await addPhoto(
      id,
      getAuth(res).sub,
      { buffer: req.file.buffer, contentType: req.file.mimetype },
      regions,
    );
    res.status(201).json(photo);
  }),
);

// GET /listings/:id/photos — фото своего объявления
listingRouter.get(
  '/:id/photos',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = listingId(req.params.id ?? '');
    const items = await getPhotos(id, getAuth(res).sub);
    res.json({ items });
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
