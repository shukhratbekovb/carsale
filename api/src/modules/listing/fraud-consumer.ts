import { logger } from '../../lib/logger.js';
import { mlFraudCheck } from '../../lib/ml-client.js';
import { findDuplicate } from '../../lib/phash.js';
import { consumeQueue } from '../../lib/queue.js';
import { notify } from '../notification/service.js';
import { findFraudSource, findOtherPhotoHashes, saveFraudDecision } from './repository.js';
import { FRAUD_CHECK_QUEUE } from './service.js';

/**
 * Consumer очереди `fraud_check` (BE-3.6, §6.2). Разбирает события, эмитируемые
 * при публикации (BE-3.5): ценовая аномалия (ML `/v1/fraud-check`) + детекция
 * дублей фото (pHash-корпус, BE-2.5). Чисто → PUBLISHED; есть сигнал → остаётся
 * в PENDING_MODERATION с fraudFlag (админ примет решение вручную, BE-8). Итог
 * фиксируется в ML_RESULT, продавец уведомляется (FR-11).
 */

// Порог совпадения pHash (64 бита): ≤ 8 бит различий → «те же фото».
const DUPLICATE_HAMMING_MAX = 8;

function extractListingId(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'listing_id' in payload) {
    const id = (payload as { listing_id: unknown }).listing_id;
    if (typeof id === 'string') return id;
  }
  return null;
}

export async function handleFraudCheck(payload: unknown): Promise<void> {
  const listingId = extractListingId(payload);
  if (!listingId) {
    logger.warn({ payload }, 'fraud-consumer: message without listing_id, skipping');
    return;
  }

  const src = await findFraudSource(listingId);
  // Идемпотентность: обрабатываем только ещё не решённые (PENDING_MODERATION без
  // выставленного fraudFlag). Уже опубликованные/флагнутые повторные сообщения — no-op.
  if (!src || src.status !== 'PENDING_MODERATION' || src.fraudFlag) {
    logger.info({ listingId, status: src?.status }, 'fraud-consumer: nothing to decide (skip)');
    return;
  }

  // 1) Ценовая аномалия (ML; сбой ML → аномалии нет, дубли всё равно проверим)
  const fraud = await mlFraudCheck({
    make: src.make,
    model: src.model,
    year: src.year,
    mileage: src.mileage,
    condition: src.condition,
    city: src.city,
    price_uzs: src.priceUzs,
  });

  // 2) Дубли фото по pHash-корпусу
  let duplicateOf: string | null = null;
  if (src.phashes.length > 0) {
    const candidates = await findOtherPhotoHashes(listingId);
    duplicateOf = findDuplicate(src.phashes, candidates, DUPLICATE_HAMMING_MAX);
  }

  const reasons: string[] = [];
  if (duplicateOf) reasons.push(`DUPLICATE_PHOTOS:${duplicateOf}`);
  if (fraud.priceAnomaly) reasons.push(`PRICE_ANOMALY:${fraud.deviationPercent}`);
  const flagged = reasons.length > 0;
  const fraudReason = flagged ? reasons.join('; ') : null;

  await saveFraudDecision(listingId, {
    status: flagged ? 'PENDING_MODERATION' : 'PUBLISHED',
    ...(flagged ? {} : { publishedAt: new Date() }),
    fraudFlag: flagged,
    fraudReason,
    imageHash: src.phashes[0] ?? null,
    computedAt: new Date(),
  });

  await notify(
    src.sellerId,
    'LISTING_STATUS',
    flagged
      ? {
          title: 'Объявление на проверке',
          message: 'Автоматическая проверка выявила признаки, требующие ручной модерации.',
          link: '/my-listings',
        }
      : {
          title: 'Объявление опубликовано',
          message: 'Ваше объявление прошло проверку и опубликовано в каталоге.',
          link: '/my-listings',
        },
  );

  logger.info({ listingId, flagged, fraudReason }, 'fraud-consumer: decided');
}

/** Регистрирует consumer очереди fraud_check (вызывается при старте сервера). */
export async function startFraudConsumer(): Promise<void> {
  await consumeQueue(FRAUD_CHECK_QUEUE, (payload) => handleFraudCheck(payload));
  logger.info({ queue: FRAUD_CHECK_QUEUE }, 'fraud-consumer: subscribed');
}
