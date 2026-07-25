import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Контрактные тесты Core↔ML (BE-2.7). Читают те же канонические фикстуры
 * ml/contracts/*.json, что и ML-сторона (ml/tests/test_contract.py), и
 * прогоняют их response через реальный декодер ml-client (fetch замокан).
 * Рассинхрон формы на любой стороне ломает тест: ML-тест — если ML перестанет
 * отдавать ключ, Core-тест — если ml-client перестанет его маппить.
 */

const envState = vi.hoisted(() => ({
  state: { NODE_ENV: 'test', ML_SERVICE_URL: 'http://ml:8000' } as {
    NODE_ENV: string;
    ML_SERVICE_URL: string | undefined;
  },
}));
vi.mock('../config/env.js', () => ({ env: envState.state }));

import { mlBlur, mlDealRating, mlFraudCheck } from './ml-client.js';

// cwd теста/typecheck = api/ → фикстуры лежат в ../ml/contracts
function fixture(name: string): { request: Record<string, unknown>; response: Record<string, unknown> } {
  return JSON.parse(readFileSync(resolve(process.cwd(), '..', 'ml', 'contracts', name), 'utf-8'));
}

function stubFetchJson(body: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  envState.state.ML_SERVICE_URL = 'http://ml:8000';
});

describe('Core↔ML contract (BE-2.7)', () => {
  it('deal-rating: ml-client маппит все поля фикстуры (pass-through snake_case)', async () => {
    const fx = fixture('deal-rating.json');
    stubFetchJson(fx.response);
    const res = await mlDealRating(fx.request as never);
    // Декодер deal-rating — pass-through: ключи совпадают с контрактом один в один
    expect(new Set(Object.keys(res))).toEqual(new Set(Object.keys(fx.response)));
    expect(res.label).toBe(fx.response.label);
    expect(res.recommended_min_uzs).toBe(fx.response.recommended_min_uzs);
    expect(typeof res.computed_at).toBe('string');
  });

  it('deal-rating: вариант UNAVAILABLE тоже соответствует форме', async () => {
    const fx = fixture('deal-rating.json') as unknown as {
      request: Record<string, unknown>;
      response_unavailable: Record<string, unknown>;
    };
    stubFetchJson(fx.response_unavailable);
    const res = await mlDealRating(fx.request as never);
    expect(res.label).toBe('UNAVAILABLE');
    expect(res.recommended_min_uzs).toBeNull();
    expect(res.recommended_max_uzs).toBeNull();
  });

  it('fraud-check: ml-client маппит snake_case → camelCase по контракту', async () => {
    const fx = fixture('fraud-check.json');
    stubFetchJson(fx.response);
    const res = await mlFraudCheck(fx.request as never);
    expect(res).toEqual({
      priceAnomaly: fx.response.price_anomaly,
      deviationPercent: fx.response.deviation_percent,
      predictedMedianUzs: fx.response.predicted_median_uzs,
    });
  });

  it('blur: ml-client маппит snake_case → camelCase + b64 → Buffer по контракту', async () => {
    const fx = fixture('blur.json');
    stubFetchJson(fx.response);
    const res = await mlBlur(Buffer.from('req-image'), 'image/jpeg');
    expect(res.plateDetected).toBe(fx.response.plate_detected);
    expect(res.regions).toEqual(fx.response.regions);
    expect(res.phash).toBe(fx.response.phash);
    expect(Buffer.isBuffer(res.blurredImage)).toBe(true);
    // b64 из фикстуры декодируется в те же байты
    expect(res.blurredImage.toString('base64')).toBe(fx.response.blurred_image_b64);
  });
});
