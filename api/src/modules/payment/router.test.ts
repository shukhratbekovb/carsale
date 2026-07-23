import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'test', JWT_SECRET: 'test-jwt-secret' } }));

const svc = vi.hoisted(() => ({ createPayment: vi.fn(), handleWebhook: vi.fn() }));
vi.mock('./service.js', () => svc);

import { AppError } from '../../lib/errors.js';
import { signAccessToken } from '../../lib/jwt.js';
import { errorHandler, notFoundHandler } from '../../middleware/error-handler.js';
import { paymentsRouter, webhooksRouter } from './router.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/payments', paymentsRouter);
  app.use('/webhooks', webhooksRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const UUID = '11111111-1111-1111-1111-111111111111';
const token = signAccessToken('buyer-1', 'BUYER');
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
const validBody = { listingId: UUID, amountUzs: 45000, gateway: 'click' };

describe('payment router (BE-6.3/6.4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /payments/create без токена → 401', async () => {
    const res = await request(app).post('/payments/create').send(validBody);
    expect(res.status).toBe(401);
    expect(svc.createPayment).not.toHaveBeenCalled();
  });

  it('POST /payments/create невалидное тело → 400', async () => {
    const res = await auth(request(app).post('/payments/create')).send({ gateway: 'stripe' });
    expect(res.status).toBe(400);
    expect(svc.createPayment).not.toHaveBeenCalled();
  });

  it('POST /payments/create валидно → 201 и userId из токена', async () => {
    svc.createPayment.mockResolvedValue({ transactionId: 'pay-1', paymentUrl: '/x' });
    const res = await auth(request(app).post('/payments/create')).send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ transactionId: 'pay-1', paymentUrl: '/x' });
    expect(svc.createPayment).toHaveBeenCalledWith(
      'buyer-1',
      expect.objectContaining({ listingId: UUID, gateway: 'click', paymentType: 'VEHICLE_REPORT' }),
    );
  });

  it('POST /webhooks/click (без auth) → 200 ack', async () => {
    svc.handleWebhook.mockResolvedValue({ status: 'SUCCESS', idempotent: false });
    const res = await request(app).post('/webhooks/click').send({ any: 'body' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ error: 0, status: 'SUCCESS' });
    expect(svc.handleWebhook).toHaveBeenCalledWith('click', { any: 'body' });
  });

  it('POST /webhooks/payme → 200 ok', async () => {
    svc.handleWebhook.mockResolvedValue({ status: 'SUCCESS', idempotent: false });
    const res = await request(app).post('/webhooks/payme').send({ any: 'body' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, status: 'SUCCESS' });
    expect(svc.handleWebhook).toHaveBeenCalledWith('payme', { any: 'body' });
  });

  it('POST /webhooks/click невалидная подпись → 401 (ошибка сервиса пробрасывается)', async () => {
    svc.handleWebhook.mockRejectedValue(new AppError(401, 'invalid_signature', 'bad'));
    const res = await request(app).post('/webhooks/click').send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('invalid_signature');
  });
});
