import { afterEach, describe, expect, it, vi } from 'vitest';

const envState = vi.hoisted(() => ({
  state: { NODE_ENV: 'test', ML_SERVICE_URL: 'http://ml:8000' } as {
    NODE_ENV: string;
    ML_SERVICE_URL: string | undefined;
  },
}));
vi.mock('../config/env.js', () => ({ env: envState.state }));

import { mlBlur, mlDealRating, mlFraudCheck } from './ml-client.js';

const okBody = {
  label: 'FAIR_PRICE',
  score: 0.87,
  recommended_min_uzs: 118_000_000,
  recommended_max_uzs: 132_000_000,
  computed_at: '2026-07-21T10:00:00Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
  envState.state.ML_SERVICE_URL = 'http://ml:8000';
});

describe('mlDealRating (BE-3.4)', () => {
  it('успех → распарсенный ответ ML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => okBody }));
    await expect(
      mlDealRating({ make: 'Chevrolet', model: 'Cobalt', year: 2020, mileage: 40000, condition: 'GOOD', city: 'Tashkent', price_uzs: 150_000_000 }),
    ).resolves.toMatchObject({ label: 'FAIR_PRICE', recommended_min_uzs: 118_000_000 });
  });

  it('не-2xx → ml_unavailable (503)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(mlDealRating({ make: 'X', model: 'Y', year: 2020, mileage: 1, condition: 'GOOD', city: 'T', price_uzs: 1 })).rejects.toMatchObject({ code: 'ml_unavailable', status: 503 });
  });

  it('сетевая ошибка/таймаут → ml_unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));
    await expect(mlDealRating({ make: 'X', model: 'Y', year: 2020, mileage: 1, condition: 'GOOD', city: 'T', price_uzs: 1 })).rejects.toMatchObject({ code: 'ml_unavailable' });
  });

  it('не задан ML_SERVICE_URL → ml_unavailable без вызова fetch', async () => {
    envState.state.ML_SERVICE_URL = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(mlDealRating({ make: 'X', model: 'Y', year: 2020, mileage: 1, condition: 'GOOD', city: 'T', price_uzs: 1 })).rejects.toMatchObject({ code: 'ml_unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('mlBlur (BE-3.3)', () => {
  const blurBody = {
    plate_detected: true,
    regions: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }],
    phash: 'ff00ff00ff00ff00',
    blurred_image_b64: Buffer.from('BLURREDJPEG').toString('base64'),
  };

  it('успех → multipart FormData, декодированный blurredImage + phash + флаги', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => blurBody });
    vi.stubGlobal('fetch', fetchMock);

    const res = await mlBlur(Buffer.from('rawjpeg'), 'image/jpeg', [{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }]);
    expect(res.plateDetected).toBe(true);
    expect(res.regions).toHaveLength(1);
    expect(res.phash).toBe('ff00ff00ff00ff00');
    expect(res.blurredImage.toString()).toBe('BLURREDJPEG');

    const [, opts] = fetchMock.mock.calls[0] as [string, { body: unknown }];
    expect(opts.body).toBeInstanceOf(FormData);
    expect((opts.body as FormData).get('regions')).toBe(JSON.stringify([{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 }]));
  });

  it('не-2xx → blur_unavailable (503)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(mlBlur(Buffer.from('x'), 'image/jpeg')).rejects.toMatchObject({ code: 'blur_unavailable', status: 503 });
  });

  it('таймаут/сетевая ошибка → blur_unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));
    await expect(mlBlur(Buffer.from('x'), 'image/jpeg')).rejects.toMatchObject({ code: 'blur_unavailable' });
  });

  it('не задан ML_SERVICE_URL → blur_unavailable без fetch', async () => {
    envState.state.ML_SERVICE_URL = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(mlBlur(Buffer.from('x'), 'image/jpeg')).rejects.toMatchObject({ code: 'blur_unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('mlFraudCheck (BE-3.6)', () => {
  const input = { make: 'Chevrolet', model: 'Cobalt', year: 2020, mileage: 40000, condition: 'GOOD', city: 'T', price_uzs: 5_000_000 };

  it('успех → маппинг price_anomaly/deviation/median', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ price_anomaly: true, deviation_percent: 70, predicted_median_uzs: 100_000_000 }),
    }));
    await expect(mlFraudCheck(input)).resolves.toEqual({ priceAnomaly: true, deviationPercent: 70, predictedMedianUzs: 100_000_000 });
  });

  it('не-2xx → «аномалии нет» (модерацию не роняем)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(mlFraudCheck(input)).resolves.toEqual({ priceAnomaly: false, deviationPercent: 0, predictedMedianUzs: null });
  });

  it('таймаут/сеть → «аномалии нет»', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));
    await expect(mlFraudCheck(input)).resolves.toMatchObject({ priceAnomaly: false });
  });

  it('не задан ML_SERVICE_URL → «аномалии нет» без fetch', async () => {
    envState.state.ML_SERVICE_URL = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(mlFraudCheck(input)).resolves.toMatchObject({ priceAnomaly: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
