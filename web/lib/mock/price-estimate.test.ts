import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mockEstimatePrice } from './price-estimate';

const BASE_INPUT = {
  make: 'Chevrolet',
  model: 'Cobalt',
  year: 2019,
  mileageKm: 78_000,
  city: 'Ташкент',
};

describe('mockEstimatePrice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('is deterministic for the same input (no randomness in the verdict)', async () => {
    const input = { ...BASE_INPUT, priceUzs: 95_000_000 };
    const promise1 = mockEstimatePrice(input);
    await vi.advanceTimersByTimeAsync(1200);
    const result1 = await promise1;

    const promise2 = mockEstimatePrice(input);
    await vi.advanceTimersByTimeAsync(1200);
    const result2 = await promise2;

    expect(result1).toEqual(result2);
  });

  test('labels a price far below the baseline as GREAT_DEAL', async () => {
    const promise = mockEstimatePrice({ ...BASE_INPUT, priceUzs: 10_000_000 });
    await vi.advanceTimersByTimeAsync(1200);
    const result = await promise;
    expect(result.label).toBe('GREAT_DEAL');
    expect(result.recommendedMin).toBeDefined();
    expect(result.recommendedMax).toBeDefined();
  });

  test('labels a price far above the baseline as OVERPRICED', async () => {
    const promise = mockEstimatePrice({ ...BASE_INPUT, priceUzs: 900_000_000 });
    await vi.advanceTimersByTimeAsync(1200);
    const result = await promise;
    expect(result.label).toBe('OVERPRICED');
  });

  test('labels a price close to the baseline as FAIR_PRICE', async () => {
    // Считаем базу той же формулой, что и мок, чтобы попасть в диапазон [min, max].
    const currentYear = new Date().getFullYear();
    const ageYears = Math.max(0, currentYear - BASE_INPUT.year);
    const ageDepreciation = Math.max(0.3, 1 - ageYears * 0.05);
    const mileageDepreciation = Math.max(0.3, 1 - BASE_INPUT.mileageKm / 300_000);
    const baseline = Math.round(100_000_000 * ageDepreciation * mileageDepreciation);

    const promise = mockEstimatePrice({ ...BASE_INPUT, priceUzs: baseline });
    await vi.advanceTimersByTimeAsync(1200);
    const result = await promise;
    expect(result.label).toBe('FAIR_PRICE');
  });

  test('returns UNAVAILABLE without a recommended range for cars older than the comparable-data cutoff', async () => {
    const promise = mockEstimatePrice({ ...BASE_INPUT, year: 1985, priceUzs: 20_000_000 });
    await vi.advanceTimersByTimeAsync(1200);
    const result = await promise;
    expect(result.label).toBe('UNAVAILABLE');
    expect(result.recommendedMin).toBeUndefined();
    expect(result.recommendedMax).toBeUndefined();
  });

  test('rejects when forceFailure is set', async () => {
    const promise = mockEstimatePrice({ ...BASE_INPUT, priceUzs: 95_000_000 }, { forceFailure: true });
    // Прикрепляем ожидание до advanceTimersByTimeAsync — иначе Node может залогировать
    // unhandled rejection warning, даже если тест в итоге проходит.
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1200);
    await assertion;
  });
});
