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
