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
  addPhoto: vi.fn(),
  getPhotos: vi.fn(),
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

  it('POST /listings/:id/photos без токена → 401', async () => {
    const res = await request(app).post(`/listings/${UUID}/photos`).attach('file', Buffer.from('x'), 'car.jpg');
    expect(res.status).toBe(401);
    expect(svc.addPhoto).not.toHaveBeenCalled();
  });

  it('POST /listings/:id/photos без файла → 400 file_required', async () => {
    const res = await auth(request(app).post(`/listings/${UUID}/photos`));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('file_required');
    expect(svc.addPhoto).not.toHaveBeenCalled();
  });

  it('POST /listings/:id/photos с файлом → 201, buffer+contentType в сервис', async () => {
    svc.addPhoto.mockResolvedValue({ id: 'p1', blurredUrl: 'u', plateDetected: true, sortOrder: 0 });
    const res = await auth(request(app).post(`/listings/${UUID}/photos`)).attach('file', Buffer.from('jpegbytes'), {
      filename: 'car.jpg',
      contentType: 'image/jpeg',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'p1', plateDetected: true });
    expect(svc.addPhoto).toHaveBeenCalledWith(
      UUID,
      'seller-1',
      expect.objectContaining({ contentType: 'image/jpeg' }),
      undefined,
    );
  });

  it('POST /listings/:id/photos с regions (JSON) → парсятся и уходят в сервис', async () => {
    svc.addPhoto.mockResolvedValue({ id: 'p1', blurredUrl: 'u', plateDetected: true, sortOrder: 0 });
    const res = await auth(request(app).post(`/listings/${UUID}/photos`))
      .field('regions', '[{"x":0.3,"y":0.7,"width":0.3,"height":0.1}]')
      .attach('file', Buffer.from('jpegbytes'), { filename: 'car.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(svc.addPhoto).toHaveBeenCalledWith(UUID, 'seller-1', expect.any(Object), [
      { x: 0.3, y: 0.7, width: 0.3, height: 0.1 },
    ]);
  });

  it('GET /listings/:id/photos → 200 { items }', async () => {
    svc.getPhotos.mockResolvedValue([{ id: 'p1', blurredUrl: 'u', plateDetected: false, sortOrder: 0 }]);
    const res = await auth(request(app).get(`/listings/${UUID}/photos`));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(svc.getPhotos).toHaveBeenCalledWith(UUID, 'seller-1');
  });
});
