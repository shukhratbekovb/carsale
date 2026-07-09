import type { BlurRegion } from '@/types/sell';

// Мок замена реальному CV-сервису детекции гос.номера/VIN на фото (FR-03).
// Реальный бюджет задержки — до 5 сек на фото; здесь используем короткую задержку,
// чтобы не тормозить разработку/тесты UI, сохраняя комментарием исходный контекст.
const MIN_LATENCY_MS = 300;
const MAX_LATENCY_MS = 900;

// Небольшая вероятность "неудачной" детекции — чтобы UI, обрабатывающий
// BLUR_FAILED, можно было увидеть и без принудительного forceFailure.
const FAILURE_RATE = 0.05;

function mockLatency(): Promise<void> {
  const delay = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Одна стабильная fake-область в нижней трети кадра — типичное расположение
// госномера на фото авто сзади/спереди. photoId не влияет на результат в моке,
// но остаётся в сигнатуре, чтобы соответствовать будущему реальному API.
function fakeRegionsFor(photoId: string): BlurRegion[] {
  void photoId;
  return [{ x: 0.35, y: 0.72, width: 0.3, height: 0.1 }];
}

export interface DetectBlurRegionsOptions {
  // Детерминированно форсирует сбой детекции — для dev-сценариев и тестов,
  // не полагаясь на случайность FAILURE_RATE.
  forceFailure?: boolean;
}

export async function mockDetectBlurRegions(
  photoId: string,
  options: DetectBlurRegionsOptions = {}
): Promise<BlurRegion[]> {
  await mockLatency();

  const shouldFail = options.forceFailure ?? Math.random() < FAILURE_RATE;
  if (shouldFail) {
    throw new Error('BLUR_DETECTION_FAILED');
  }

  return fakeRegionsFor(photoId);
}
