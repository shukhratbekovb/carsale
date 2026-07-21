import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { publishEvent } from '../../lib/queue.js';
import {
  createDraft as repoCreateDraft,
  findOwnedState,
  listBySeller,
  type MyListingRow,
  setStatus,
  updateDraft as repoUpdateDraft,
} from './repository.js';
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
}
