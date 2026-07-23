import { env } from '../config/env.js';
import { AppError } from './errors.js';

/**
 * HTTP-клиент ML-сервиса (BE-3.4). Контракт — docs/analysis/10-integrations-api.md §2.4.
 * Deal Rating: timeout 1.5с (§2.4 «Timeout Core API: 1500 мс»); при таймауте/сбое
 * бросает ml_unavailable, вызывающий деградирует в UNAVAILABLE.
 */

const DEAL_RATING_TIMEOUT_MS = 1_500;

export interface DealRatingInput {
  make: string;
  model: string;
  year: number;
  mileage: number;
  condition: string;
  city: string;
  price_uzs: number;
}

export interface DealRatingResponse {
  label: string;
  score: number;
  recommended_min_uzs: number | null;
  recommended_max_uzs: number | null;
  computed_at: string;
}

// --- Blur (BE-3.3, §2.4) ---

const BLUR_TIMEOUT_MS = 6_000; // SLA p95 < 5000мс + запас

export interface BlurRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlurResult {
  plateDetected: boolean;
  regions: BlurRegion[];
  /** Перцептивный хеш оригинала (hex) — детекция дублей фото (BE-2.5/3.6). */
  phash: string;
  /** Готовое blurred-изображение (JPEG) для загрузки в public-бакет. */
  blurredImage: Buffer;
}

/**
 * Блюр госномера через ML `/v1/blur` (multipart). regions — опц. ручная
 * корректировка продавца. Любой сбой/таймаут → AppError blur_unavailable (503):
 * НЕ деградируем в «сохранить оригинал», это была бы утечка номера.
 */
export async function mlBlur(
  file: Buffer,
  contentType: string,
  regions?: BlurRegion[],
): Promise<BlurResult> {
  if (!env.ML_SERVICE_URL) {
    throw new AppError(503, 'blur_unavailable', 'ML_SERVICE_URL is not configured');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BLUR_TIMEOUT_MS);
  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file)], { type: contentType }), 'photo.jpg');
    if (regions && regions.length > 0) form.append('regions', JSON.stringify(regions));

    const res = await fetch(`${env.ML_SERVICE_URL}/v1/blur`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new AppError(503, 'blur_unavailable', `ML blur responded ${res.status}`);
    }
    const body = (await res.json()) as {
      plate_detected: boolean;
      regions: BlurRegion[];
      phash: string;
      blurred_image_b64: string;
    };
    return {
      plateDetected: body.plate_detected,
      regions: body.regions,
      phash: body.phash,
      blurredImage: Buffer.from(body.blurred_image_b64, 'base64'),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, 'blur_unavailable', 'ML blur service is unavailable');
  } finally {
    clearTimeout(timer);
  }
}

// --- Fraud check (BE-2.5/3.6, §2.4) ---

const FRAUD_TIMEOUT_MS = 1_500;

export interface FraudCheckInput {
  make: string;
  model: string;
  year: number;
  mileage: number;
  condition: string;
  city: string;
  price_uzs: number;
}

export interface FraudCheckResponse {
  priceAnomaly: boolean;
  deviationPercent: number;
  predictedMedianUzs: number | null;
}

/**
 * Ценовая аномалия через ML `/v1/fraud-check` (§2.4). Сбой/таймаут не роняет
 * модерацию: возвращает «аномалии нет» (дубли всё равно проверит consumer).
 */
export async function mlFraudCheck(input: FraudCheckInput): Promise<FraudCheckResponse> {
  const NONE: FraudCheckResponse = { priceAnomaly: false, deviationPercent: 0, predictedMedianUzs: null };
  if (!env.ML_SERVICE_URL) return NONE;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FRAUD_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.ML_SERVICE_URL}/v1/fraud-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) return NONE;
    const body = (await res.json()) as {
      price_anomaly: boolean;
      deviation_percent: number;
      predicted_median_uzs: number | null;
    };
    return {
      priceAnomaly: body.price_anomaly,
      deviationPercent: body.deviation_percent,
      predictedMedianUzs: body.predicted_median_uzs,
    };
  } catch {
    return NONE;
  } finally {
    clearTimeout(timer);
  }
}

export async function mlDealRating(input: DealRatingInput): Promise<DealRatingResponse> {
  if (!env.ML_SERVICE_URL) {
    throw new AppError(503, 'ml_unavailable', 'ML_SERVICE_URL is not configured');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEAL_RATING_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.ML_SERVICE_URL}/v1/deal-rating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new AppError(503, 'ml_unavailable', `ML service responded ${res.status}`);
    }
    return (await res.json()) as DealRatingResponse;
  } catch (err) {
    if (err instanceof AppError) throw err;
    // таймаут (abort) или сетевая ошибка
    throw new AppError(503, 'ml_unavailable', 'ML service is unavailable');
  } finally {
    clearTimeout(timer);
  }
}
