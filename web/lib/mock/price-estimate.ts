import type { DealRatingLabel } from '@/types/listing';

// Мок замена реальному ML-сервису оценки цены (FR-05, Deal Rating) для
// PriceEstimateWidget на стороне продавца.
const MIN_LATENCY_MS = 500;
const MAX_LATENCY_MS = 1200;

function mockLatency(): Promise<void> {
  const delay = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export interface PriceEstimateInput {
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  city: string;
  priceUzs: number;
}

export interface PriceEstimateResult {
  label: DealRatingLabel;
  recommendedMin?: number;
  recommendedMax?: number;
}

export interface EstimatePriceOptions {
  // Форсирует сбой самого запроса (для UI/тестов FAILED-состояния виджета) —
  // отдельно от UNAVAILABLE, который эта функция возвращает как обычный (успешный)
  // результат, когда "модель" не набрала уверенности в вердикте.
  forceFailure?: boolean;
}

// Год, начиная с недостающих сравнимых объявлений в моке — раньше него считаем,
// что данных недостаточно для вердикта (UNAVAILABLE), а не гадаем.
const MIN_COMPARABLE_YEAR = 1990;

const PREMIUM_MAKES = new Set(['BMW', 'Mercedes-Benz', 'Lexus', 'Toyota', 'BYD']);

// Детерминированная псевдо-база оценки по марке/году/пробегу — намеренно не
// случайная, чтобы один и тот же ввод всегда давал один и тот же результат
// (FR-05: сравнение цены с рекомендованным диапазоном, а не лотерея).
function computeBaselinePriceUzs(input: Pick<PriceEstimateInput, 'make' | 'year' | 'mileageKm'>): number {
  const currentYear = new Date().getFullYear();
  const ageYears = Math.max(0, currentYear - input.year);

  const baseUzs = PREMIUM_MAKES.has(input.make) ? 250_000_000 : 100_000_000;
  const ageDepreciation = Math.max(0.3, 1 - ageYears * 0.05);
  const mileageDepreciation = Math.max(0.3, 1 - input.mileageKm / 300_000);

  return Math.round(baseUzs * ageDepreciation * mileageDepreciation);
}

export async function mockEstimatePrice(
  input: PriceEstimateInput,
  options: EstimatePriceOptions = {}
): Promise<PriceEstimateResult> {
  await mockLatency();

  if (options.forceFailure) {
    throw new Error('PRICE_ESTIMATE_FAILED');
  }

  if (input.year < MIN_COMPARABLE_YEAR) {
    return { label: 'UNAVAILABLE' };
  }

  const baseline = computeBaselinePriceUzs(input);
  const recommendedMin = Math.round(baseline * 0.9);
  const recommendedMax = Math.round(baseline * 1.1);

  let label: DealRatingLabel;
  if (input.priceUzs < recommendedMin) {
    label = 'GREAT_DEAL';
  } else if (input.priceUzs > recommendedMax) {
    label = 'OVERPRICED';
  } else {
    label = 'FAIR_PRICE';
  }

  return { label, recommendedMin, recommendedMax };
}
