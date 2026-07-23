import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { type BlurRegion, mlBlur, mlDealRating } from '../../lib/ml-client.js';
import { publishEvent } from '../../lib/queue.js';
import { putObject } from '../../lib/s3.js';
import { notify } from '../notification/service.js';
import {
  createDraft as repoCreateDraft,
  createPhoto,
  findEstimateSource,
  findOwnedState,
  listBySeller,
  listPhotos,
  type MyListingRow,
  type PhotoRow,
  saveDealRating,
  setStatus,
  updateDraft as repoUpdateDraft,
} from './repository.js';
import type { DealRatingLabel } from '@prisma/client';
import { assertTransition, isEditable } from './status-machine.js';
import type { DraftInput, UpdateInput } from './validation.js';

export const MAX_PHOTOS = 20;

/** Listing-сервис (BE-3.1/3.5): черновики продавца + публикация на модерацию. */

export const FRAUD_CHECK_QUEUE = 'fraud_check';

export interface MyListing {
  id: string;
  status: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  priceUzs: number;
  city: string;
  dealRatingLabel: string | null;
  mileageFlag: boolean;
  fraudFlag: boolean;
  createdAt: string;
  updatedAt: string;
}

function toMyListing(row: MyListingRow): MyListing {
  return {
    id: row.id,
    status: row.status,
    make: row.vehicle?.make ?? '',
    model: row.vehicle?.model ?? '',
    year: row.vehicle?.year ?? 0,
    mileageKm: row.vehicle?.mileage ?? 0,
    priceUzs: row.priceUzs.toNumber(),
    city: row.city,
    dealRatingLabel: row.dealRatingLabel,
    mileageFlag: row.mileageFlag,
    fraudFlag: row.fraudFlag,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createDraft(sellerId: string, input: DraftInput): Promise<{ id: string }> {
  return repoCreateDraft(sellerId, input);
}

export async function updateDraft(
  id: string,
  sellerId: string,
  input: UpdateInput,
): Promise<void> {
  const state = await findOwnedState(id, sellerId);
  if (!state) throw new AppError(404, 'listing_not_found', 'Listing not found');
  if (!isEditable(state.status)) {
    throw new AppError(409, 'listing_not_editable', `Listing in status ${state.status} cannot be edited`, {
      status: state.status,
    });
  }
  // REJECTED → DRAFT при повторной правке (07 §2.1)
  const nextStatus = state.status === 'REJECTED' ? 'DRAFT' : undefined;
  await repoUpdateDraft(id, input, nextStatus);
}

export async function listMine(sellerId: string): Promise<MyListing[]> {
  const rows = await listBySeller(sellerId);
  return rows.map(toMyListing);
}

/**
 * Публикация: DRAFT → PENDING_MODERATION + асинхронное событие fraud_check (§6.2).
 * Требует ≥1 фото (07 §2.1 предусловие). Событие — best-effort: сбой очереди
 * логируется, но не откатывает переход (fraud-consumer BE-3.6 обработает позже).
 */
export async function publish(id: string, sellerId: string): Promise<void> {
  const state = await findOwnedState(id, sellerId);
  if (!state) throw new AppError(404, 'listing_not_found', 'Listing not found');
  if (state.status !== 'DRAFT') {
    throw new AppError(409, 'invalid_status_transition', `Cannot publish a listing in status ${state.status}`, {
      from: state.status,
    });
  }
  if (state.photoCount < 1) {
    throw new AppError(400, 'photos_required', 'At least one photo is required to publish');
  }

  assertTransition('DRAFT', 'PENDING_MODERATION');
  await setStatus(id, 'PENDING_MODERATION');

  try {
    await publishEvent(FRAUD_CHECK_QUEUE, { action: 'fraud_check', listing_id: id });
  } catch (err) {
    logger.warn({ err, listingId: id }, 'publish: failed to emit fraud_check event');
  }

  // Уведомление продавцу о смене статуса (FR-11, LISTING_STATUS)
  await notify(sellerId, 'LISTING_STATUS', {
    title: 'Объявление на модерации',
    message: 'Ваше объявление отправлено на проверку',
    link: '/my-listings',
  });
}

const VALID_LABELS: ReadonlySet<string> = new Set([
  'GREAT_DEAL',
  'FAIR_PRICE',
  'OVERPRICED',
  'UNAVAILABLE',
]);
const normalizeLabel = (label: string): DealRatingLabel =>
  (VALID_LABELS.has(label) ? label : 'UNAVAILABLE') as DealRatingLabel;

export interface PriceEstimate {
  label: string;
  recommendedMin?: number;
  recommendedMax?: number;
}

/**
 * Оценка цены (BE-3.4, §6.2): признаки объявления → ML `/v1/deal-rating`,
 * вердикт сохраняется на объявлении + ML_RESULT. Таймаут/сбой ML → UNAVAILABLE
 * (§2.4), не 5xx. Контракт ответа = web/lib/mock/price-estimate.ts (seller видит
 * диапазон, в отличие от публичного каталога).
 */
export async function estimatePrice(id: string, sellerId: string): Promise<PriceEstimate> {
  const src = await findEstimateSource(id, sellerId);
  if (!src) throw new AppError(404, 'listing_not_found', 'Listing not found');

  try {
    const ml = await mlDealRating({
      make: src.make,
      model: src.model,
      year: src.year,
      mileage: src.mileage,
      condition: src.condition,
      city: src.city,
      price_uzs: src.priceUzs,
    });
    const label = normalizeLabel(ml.label);
    await saveDealRating(id, {
      label,
      score: ml.score,
      recommendedMin: ml.recommended_min_uzs,
      recommendedMax: ml.recommended_max_uzs,
      computedAt: new Date(ml.computed_at),
    });
    const result: PriceEstimate = { label };
    if (ml.recommended_min_uzs != null) result.recommendedMin = ml.recommended_min_uzs;
    if (ml.recommended_max_uzs != null) result.recommendedMax = ml.recommended_max_uzs;
    return result;
  } catch (err) {
    logger.warn({ err, listingId: id }, 'price-estimate: ML unavailable, degrading to UNAVAILABLE');
    await saveDealRating(id, {
      label: 'UNAVAILABLE',
      score: null,
      recommendedMin: null,
      recommendedMax: null,
      computedAt: new Date(),
    }).catch(() => undefined);
    return { label: 'UNAVAILABLE' };
  }
}

// --- Фото (BE-3.3, §6.2) ---

export interface UploadedPhoto {
  buffer: Buffer;
  contentType: string;
}

export interface PhotoDTO {
  id: string;
  blurredUrl: string;
  plateDetected: boolean;
  sortOrder: number;
}

const toPhotoDTO = (row: PhotoRow): PhotoDTO => ({
  id: row.id,
  blurredUrl: row.blurredUrl,
  plateDetected: row.plateDetected,
  sortOrder: row.sortOrder,
});

/** Публичный URL blurred-версии: CDN в prod (S3_PUBLIC_URL), иначе сам MinIO-endpoint. */
function publicBlurredUrl(key: string): string {
  const base = env.S3_PUBLIC_URL ?? env.S3_ENDPOINT ?? '';
  return `${base.replace(/\/$/, '')}/${env.S3_BUCKET_BLURRED}/${key}`;
}

/**
 * Загрузка фото (BE-3.3, §6.2): фото → ML `/v1/blur` → MinIO. Оригинал в private-
 * бакет (BR-3), blurred-версия в public → отдаётся из каталога. Доступно владельцу
 * на редактируемом объявлении (DRAFT/REJECTED), лимит 20 (§6.2). regions — опц.
 * ручная корректировка области (FR-03). Блюр обязателен: сбой ML → 503, фото НЕ
 * сохраняется (не публикуем оригинал с незаблюренным номером).
 */
export async function addPhoto(
  id: string,
  sellerId: string,
  file: UploadedPhoto,
  regions?: BlurRegion[],
): Promise<PhotoDTO> {
  const state = await findOwnedState(id, sellerId);
  if (!state) throw new AppError(404, 'listing_not_found', 'Listing not found');
  if (!isEditable(state.status)) {
    throw new AppError(409, 'listing_not_editable', `Listing in status ${state.status} cannot be edited`, {
      status: state.status,
    });
  }
  if (state.photoCount >= MAX_PHOTOS) {
    throw new AppError(400, 'photo_limit_reached', `A listing can have at most ${MAX_PHOTOS} photos`, {
      max: MAX_PHOTOS,
    });
  }

  const blur = await mlBlur(file.buffer, file.contentType, regions);

  const photoId = randomUUID();
  const originalKey = `originals/${id}/${photoId}.jpg`;
  const blurredKey = `blurred/${id}/${photoId}.jpg`;

  // Оригинал — private-бакет (номер виден только в оригинале), blurred — public.
  await putObject(env.S3_BUCKET_ORIGINALS, originalKey, file.buffer, file.contentType);
  await putObject(env.S3_BUCKET_BLURRED, blurredKey, blur.blurredImage, 'image/jpeg');

  const row = await createPhoto({
    id: photoId,
    listingId: id,
    blurredUrl: publicBlurredUrl(blurredKey),
    originalKey,
    plateDetected: blur.plateDetected,
    sortOrder: state.photoCount,
  });
  return toPhotoDTO(row);
}

export async function getPhotos(id: string, sellerId: string): Promise<PhotoDTO[]> {
  const state = await findOwnedState(id, sellerId);
  if (!state) throw new AppError(404, 'listing_not_found', 'Listing not found');
  const rows = await listPhotos(id);
  return rows.map(toPhotoDTO);
}
