import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'test', JWT_SECRET: 'test-jwt-secret' } }));

// Мокаем сервис — роутер-тест проверяет auth-гейт, валидацию, статусы, проброс ошибок
const svc = vi.hoisted(() => ({
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  listMine: vi.fn(),
  publish: vi.fn(),
  estimatePrice: vi.fn(),
}));
vi.mock('./service.js', () => svc);

import { AppError } from '../../lib/errors.js';
import { signAccessToken } from '../../lib/jwt.js';
import { errorHandler, notFoundHandler } from '../../middleware/error-handler.js';
import { listingRouter, myListingsRouter } from './router.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/listings', listingRouter);
  app.use('/my', myListingsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const UUID = '11111111-1111-1111-1111-111111111111';
const token = signAccessToken('seller-1', 'SELLER');
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

const validDraft = {
  make: 'Chevrolet',
  model: 'Cobalt',
  year: 2020,
  mileageKm: 40000,
  condition: 'GOOD',
  transmission: 'AUTOMATIC',
  driveType: 'FWD',
  city: 'Tashkent',
  priceUzs: 150000000,
};

describe('listing router (BE-3.1/3.5)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /listings/draft без токена → 401', async () => {
    const res = await request(app).post('/listings/draft').send(validDraft);
    expect(res.status).toBe(401);
    expect(svc.createDraft).not.toHaveBeenCalled();
  });

  it('POST /listings/draft невалидное тело → 400', async () => {
    const res = await auth(request(app).post('/listings/draft')).send({ make: 'X' });
    expect(res.status).toBe(400);
    expect(svc.createDraft).not.toHaveBeenCalled();
  });

  it('POST /listings/draft валидно → 201 { id } и sellerId из токена', async () => {
    svc.createDraft.mockResolvedValue({ id: UUID });
    const res = await auth(request(app).post('/listings/draft')).send(validDraft);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: UUID, status: 'DRAFT' });
    expect(svc.createDraft).toHaveBeenCalledWith('seller-1', expect.objectContaining({ make: 'Chevrolet' }));
  });

  it('PUT /listings/:id валидно → 200', async () => {
    svc.updateDraft.mockResolvedValue(undefined);
    const res = await auth(request(app).put(`/listings/${UUID}`)).send({ priceUzs: 140000000 });
    expect(res.status).toBe(200);
    expect(svc.updateDraft).toHaveBeenCalledWith(UUID, 'seller-1', { priceUzs: 140000000 });
  });

  it('PUT /listings/:id не-uuid → 404', async () => {
    const res = await auth(request(app).put('/listings/garbage')).send({ priceUzs: 1 });
    expect(res.status).toBe(404);
  });

  it('POST /listings/:id/publish → 202 pending_moderation', async () => {
    svc.publish.mockResolvedValue(undefined);
    const res = await auth(request(app).post(`/listings/${UUID}/publish`));
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'pending_moderation' });
  });

  it('POST /listings/:id/publish без фото → 400 (ошибка сервиса пробрасывается)', async () => {
    svc.publish.mockRejectedValue(new AppError(400, 'photos_required', 'need photo'));
    const res = await auth(request(app).post(`/listings/${UUID}/publish`));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('photos_required');
  });

  it('POST /listings/:id/price-estimate → 200 с оценкой', async () => {
    svc.estimatePrice.mockResolvedValue({ label: 'FAIR_PRICE', recommendedMin: 1, recommendedMax: 2 });
    const res = await auth(request(app).post(`/listings/${UUID}/price-estimate`));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ label: 'FAIR_PRICE', recommendedMin: 1, recommendedMax: 2 });
    expect(svc.estimatePrice).toHaveBeenCalledWith(UUID, 'seller-1');
  });

  it('GET /my/listings → 200 { items }', async () => {
    svc.listMine.mockResolvedValue([{ id: UUID, status: 'DRAFT' }]);
    const res = await auth(request(app).get('/my/listings'));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(svc.listMine).toHaveBeenCalledWith('seller-1');
  });
});
