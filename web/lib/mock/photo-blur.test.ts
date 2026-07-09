import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mockDetectBlurRegions } from './photo-blur';

describe('mockDetectBlurRegions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('resolves at least one normalized (0..1) bounding box on success', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // выше FAILURE_RATE -> успех
    const promise = mockDetectBlurRegions('photo-1');
    await vi.advanceTimersByTimeAsync(900);
    const regions = await promise;

    expect(regions.length).toBeGreaterThan(0);
    for (const region of regions) {
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.x).toBeLessThanOrEqual(1);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeLessThanOrEqual(1);
      expect(region.width).toBeGreaterThan(0);
      expect(region.height).toBeGreaterThan(0);
    }
  });

  test('rejects when forceFailure is set, regardless of randomness', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const promise = mockDetectBlurRegions('photo-1', { forceFailure: true });
    // Прикрепляем ожидание до advanceTimersByTimeAsync, иначе rejection может
    // "выстрелить" раньше, чем к промису присоединится обработчик (unhandled
    // rejection warning от Node, хоть тест и не падает).
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(900);
    await assertion;
  });

  test('rejects when the random failure roll is under FAILURE_RATE', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.001);
    const promise = mockDetectBlurRegions('photo-1');
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(900);
    await assertion;
  });
});
