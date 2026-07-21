import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'test', JWT_SECRET: 's' } }));

// Мокаем сервисный слой — роутер-тест проверяет валидацию, cookie и статусы,
// а не оркестрацию (её покрывают otp-service/jwt-тесты)
const svc = {
  requestOtp: vi.fn(),
  verify: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
};
vi.mock('./service.js', () => ({ getAuthService: () => svc }));

import { errorHandler } from '../../middleware/error-handler.js';
import { authRouter } from './router.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('auth router (BE-1.3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /otp/send: невалидный номер → 400', async () => {
    const res = await request(app).post('/auth/otp/send').send({ phone: '12345' });
    expect(res.status).toBe(400);
    expect(svc.requestOtp).not.toHaveBeenCalled();
  });

  it('POST /otp/send: валидный номер → 200 { expires_in }', async () => {
    svc.requestOtp.mockResolvedValue({ expiresIn: 300 });
    const res = await request(app).post('/auth/otp/send').send({ phone: '+998901234567' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ expires_in: 300 });
  });

  it('POST /otp/verify: без согласия ПД → 400 (NFR-20)', async () => {
    const res = await request(app)
      .post('/auth/otp/verify')
      .send({ phone: '+998901234567', code: '123456', marketingConsent: false });
    expect(res.status).toBe(400);
    expect(svc.verify).not.toHaveBeenCalled();
  });

  it('POST /otp/verify: новый пользователь → 201 + refresh cookie, тела без refresh_token', async () => {
    svc.verify.mockResolvedValue({
      user: { id: 'u1', role: 'BUYER' },
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
      isNew: true,
    });
    const res = await request(app)
      .post('/auth/otp/verify')
      .send({ phone: '+998901234567', code: '123456', personalDataConsent: true });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ access_token: 'access-abc', user: { id: 'u1', role: 'BUYER' } });
    expect(res.body.refresh_token).toBeUndefined();
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toContain('refresh_token=refresh-xyz');
    expect(setCookie).toContain('HttpOnly');
  });

  it('POST /otp/verify: существующий пользователь → 200', async () => {
    svc.verify.mockResolvedValue({
      user: { id: 'u1' },
      accessToken: 'a',
      refreshToken: 'r',
      isNew: false,
    });
    const res = await request(app)
      .post('/auth/otp/verify')
      .send({ phone: '+998901234567', code: '123456', personalDataConsent: true });
    expect(res.status).toBe(200);
  });

  it('POST /refresh: без cookie → 401 no_refresh_token', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('no_refresh_token');
  });

  it('POST /refresh: с cookie → 200 + новый refresh cookie', async () => {
    svc.refresh.mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' });
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'refresh_token=r1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ access_token: 'a2' });
    expect(svc.refresh).toHaveBeenCalledWith('r1');
    expect(String(res.headers['set-cookie'])).toContain('refresh_token=r2');
  });

  it('POST /logout: 204 + очистка cookie, вызывает сервис при наличии токена', async () => {
    const res = await request(app).post('/auth/logout').set('Cookie', 'refresh_token=r1');
    expect(res.status).toBe(204);
    expect(svc.logout).toHaveBeenCalledWith('r1');
    expect(String(res.headers['set-cookie'])).toContain('refresh_token=;');
  });
});
