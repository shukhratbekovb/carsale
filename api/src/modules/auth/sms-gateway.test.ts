import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../lib/errors.js';
import { EskizSmsGateway, MockSmsGateway } from './sms-gateway.js';

// logger в тестовой среде silent (env.NODE_ENV=test), моки не нужны

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const okResponse = (): Response =>
  ({ ok: true, status: 200 }) as Response;
const errResponse = (status: number): Response =>
  ({ ok: false, status }) as Response;

// нулевые задержки ретраев — тесты не ждут реальные 2с/5с
const gw = (): EskizSmsGateway => new EskizSmsGateway({ token: 't', retryDelaysMs: [0, 0] });

describe('EskizSmsGateway (BE-1.1)', () => {
  it('успех с первой попытки — один запрос', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(gw().sendOtp('998901234567', '123456')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('422 → invalid_phone (400) без ретраев', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errResponse(422));
    vi.stubGlobal('fetch', fetchMock);

    await expect(gw().sendOtp('998901234567', '123456')).rejects.toMatchObject({
      code: 'invalid_phone',
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('5xx затем ok → ретраит и завершается успешно', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errResponse(503))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await expect(gw().sendOtp('998901234567', '123456')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('все попытки провалены → sms_unavailable (503), исчерпаны все попытки', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(gw().sendOtp('998901234567', '123456')).rejects.toMatchObject({
      code: 'sms_unavailable',
      status: 503,
    });
    // 1 первичная + 2 ретрая
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('AppError sms_unavailable — экземпляр AppError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errResponse(500)));
    await expect(gw().sendOtp('998901234567', '123456')).rejects.toBeInstanceOf(AppError);
  });
});

describe('MockSmsGateway (BE-1.1)', () => {
  it('никогда не падает', async () => {
    await expect(new MockSmsGateway().sendOtp('998901234567', '123456')).resolves.toBeUndefined();
  });
});
