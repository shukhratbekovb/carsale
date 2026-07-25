import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { fetchMe, logout, refreshSession, sendOtp, verifyOtp } from './auth-api';

// coreFetch ходит на same-origin /api/core/* через global fetch — мокаем его.
function stubFetch(status: number, body: unknown, contentType = 'application/json') {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => body,
  };
  const mock = vi.fn().mockResolvedValue(res);
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => vi.unstubAllGlobals());

describe('auth-api (§5)', () => {
  it('sendOtp: POST /auth/otp/send, распаковывает expires_in', async () => {
    const fetchMock = stubFetch(200, { expires_in: 300 });
    await expect(sendOtp('+998901112233')).resolves.toEqual({ expiresIn: 300 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/core/auth/otp/send');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ phone: '+998901112233' });
    expect(init.credentials).toBe('same-origin');
  });

  it('verifyOtp: всегда шлёт personalDataConsent:true + маппит user', async () => {
    const fetchMock = stubFetch(200, {
      access_token: 'tok-1',
      user: {
        id: 'u1',
        role: 'BUYER',
        verification_status: 'PHONE_VERIFIED',
        email: null,
        marketing_consent: true,
        created_at: '2026-07-25T00:00:00.000Z',
      },
    });
    const res = await verifyOtp({ phone: '+998901112233', code: '123456', marketingConsent: true });
    expect(res.accessToken).toBe('tok-1');
    expect(res.user).toMatchObject({ id: 'u1', verificationStatus: 'PHONE_VERIFIED', marketingConsent: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      phone: '+998901112233',
      code: '123456',
      personalDataConsent: true,
      marketingConsent: true,
    });
  });

  it('verifyOtp: 400 invalid_otp → ApiError с кодом', async () => {
    stubFetch(400, { error: 'Invalid code', code: 'invalid_otp' });
    await expect(
      verifyOtp({ phone: '+998901112233', code: '000000', marketingConsent: false }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_otp' });
  });

  it('refreshSession: POST /auth/refresh без Authorization', async () => {
    const fetchMock = stubFetch(200, { access_token: 'tok-2' });
    await expect(refreshSession()).resolves.toEqual({ accessToken: 'tok-2' });
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBeUndefined();
  });

  it('refreshSession: 401 без cookie → ApiError', async () => {
    stubFetch(401, { error: 'Missing refresh token', code: 'no_refresh_token' });
    await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);
  });

  it('logout: POST /auth/logout', async () => {
    const fetchMock = stubFetch(200, { ok: true });
    await logout();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/core/auth/logout');
  });

  it('fetchMe: GET /me с Bearer, маппит профиль', async () => {
    const fetchMock = stubFetch(200, {
      id: 'u1',
      role: 'BUYER',
      verificationStatus: 'PHONE_VERIFIED',
      email: null,
      createdAt: '2026-07-25T00:00:00.000Z',
      consents: { personalData: true, marketing: false, acceptedAt: '2026-07-25T00:00:00.000Z' },
    });
    const me = await fetchMe('tok-1');
    expect(me).toMatchObject({ id: 'u1', marketingConsent: false });
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer tok-1');
  });
});
