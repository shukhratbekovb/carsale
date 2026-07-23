import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { mlDealRating } from '../../lib/ml-client.js';
import { publishEvent } from '../../lib/queue.js';
import { notify } from '../notification/service.js';
import {
  createDraft as repoCreateDraft,
  findEstimateSource,
  findOwnedState,
  listBySeller,
  type MyListingRow,
  saveDealRating,
  setStatus,
  updateDraft as repoUpdateDraft,
} from './repository.js';
import type { DealRatingLabel } from '@prisma/client';
import { assertTransition, isEditable } from './status-machine.js';
import type { DraftInput, UpdateInput } from './validation.js';

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
