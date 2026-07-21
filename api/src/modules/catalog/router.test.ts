import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Мокаем репозиторий — роутер-тест проверяет форму ответа/пагинацию/similar/404,
// без БД. Маппер работает по-настоящему (чистая функция).
// vi.hoisted: фабрика vi.mock поднимается выше объявлений, поэтому объект — тоже
const repo = vi.hoisted(() => ({
  findPublished: vi.fn(),
  findByIdPublic: vi.fn(),
  findSimilar: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

import { Prisma } from '@prisma/client';
import type { PublicListingRow } from './mapper.js';
import { errorHandler, notFoundHandler } from '../../middleware/error-handler.js';
import { catalogRouter } from './router.js';

function fakeRow(id: string, make = 'Chevrolet'): PublicListingRow {
  return {
    id,
    priceUzs: new Prisma.Decimal(100_000_000),
    description: null,
    city: 'Tashkent',
    dealRatingLabel: 'FAIR_PRICE',
    mileageFlag: false,
    mileageFlagReason: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    vehicle: {
      make,
      model: 'Cobalt',
      year: 2020,
      mileage: 40000,
      condition: 'GOOD',
      color: null,
      engineVolume: null,
      fuelType: null,
      transmission: 'AUTOMATIC',
      driveType: 'FWD',
    },
    photos: [],
    seller: { verificationStatus: 'PHONE_VERIFIED' },
  } as unknown as PublicListingRow;
}

function buildApp() {
  const app = express();
  app.use('/listings', catalogRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const UUID = '11111111-1111-1111-1111-111111111111';

describe('catalog router (BE-4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /listings → items + мета пагинации', async () => {
    repo.findPublished.mockResolvedValue({ items: [fakeRow(UUID)], total: 1 });
    const res = await request(app).get('/listings?make=Chevrolet');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.page_size).toBe(20);
    expect(res.body.items[0]).toMatchObject({ id: UUID, make: 'Chevrolet', driveType: 'FWD' });
    expect(res.body.similar).toBeUndefined();
  });

  it('GET /listings пустая выдача → similar (UC-01 alt-flow)', async () => {
    repo.findPublished.mockResolvedValue({ items: [], total: 0 });
    repo.findSimilar.mockResolvedValue([fakeRow(UUID, 'Kia')]);
    const res = await request(app).get('/listings?make=Tesla');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
    expect(res.body.similar).toHaveLength(1);
    expect(res.body.similar[0].make).toBe('Kia');
  });

  it('GET /listings невалидный enum → 400', async () => {
    const res = await request(app).get('/listings?transmission=ROCKET');
    expect(res.status).toBe(400);
    expect(repo.findPublished).not.toHaveBeenCalled();
  });

  it('GET /listings/:id найдено → публичная карточка', async () => {
    repo.findByIdPublic.mockResolvedValue(fakeRow(UUID));
    const res = await request(app).get(`/listings/${UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(UUID);
  });

  it('GET /listings/:id не найдено → 404 listing_not_found', async () => {
    repo.findByIdPublic.mockResolvedValue(null);
    const res = await request(app).get(`/listings/${UUID}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('listing_not_found');
  });

  it('GET /listings/:id не-uuid → 404 без обращения к БД', async () => {
    const res = await request(app).get('/listings/not-a-uuid');
    expect(res.status).toBe(404);
    expect(repo.findByIdPublic).not.toHaveBeenCalled();
  });
});
