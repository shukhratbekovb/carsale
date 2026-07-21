import { afterEach, describe, expect, it, vi } from 'vitest';

const envState = vi.hoisted(() => ({
  state: { NODE_ENV: 'test', ML_SERVICE_URL: 'http://ml:8000' } as {
    NODE_ENV: string;
    ML_SERVICE_URL: string | undefined;
  },
}));
vi.mock('../config/env.js', () => ({ env: envState.state }));

import { mlDealRating } from './ml-client.js';

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
