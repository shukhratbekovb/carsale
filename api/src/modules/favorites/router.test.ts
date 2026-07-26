import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'test', JWT_SECRET: 'test-jwt-secret' } }));

const svc = vi.hoisted(() => ({
  getFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));
vi.mock('./service.js', () => svc);

import { signAccessToken } from '../../lib/jwt.js';
import { errorHandler, notFoundHandler } from '../../middleware/error-handler.js';
import { favoritesRouter } from './router.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/favorites', favoritesRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const UUID = '11111111-1111-1111-1111-111111111111';
const token = signAccessToken('u1', 'BUYER');
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

describe('favorites router (FR-13)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('без токена → 401', async () => {
    const res = await request(app).get('/favorites');
    expect(res.status).toBe(401);
    expect(svc.getFavorites).not.toHaveBeenCalled();
  });

  it('GET /favorites → 200 { items }', async () => {
    svc.getFavorites.mockResolvedValue({ items: [{ id: 'l1' }] });
    const res = await auth(request(app).get('/favorites'));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(svc.getFavorites).toHaveBeenCalledWith('u1');
  });

  it('POST /favorites/:id (uuid) → addFavorite(userId, id)', async () => {
    svc.addFavorite.mockResolvedValue({ listingId: UUID, favorited: true });
    const res = await auth(request(app).post(`/favorites/${UUID}`));
    expect(res.status).toBe(200);
    expect(svc.addFavorite).toHaveBeenCalledWith('u1', UUID);
  });

  it('POST /favorites/:id не-uuid → 404', async () => {
    const res = await auth(request(app).post('/favorites/garbage'));
    expect(res.status).toBe(404);
    expect(svc.addFavorite).not.toHaveBeenCalled();
  });

  it('DELETE /favorites/:id → removeFavorite(userId, id)', async () => {
    svc.removeFavorite.mockResolvedValue({ listingId: UUID, favorited: false });
    const res = await auth(request(app).delete(`/favorites/${UUID}`));
    expect(res.status).toBe(200);
    expect(svc.removeFavorite).toHaveBeenCalledWith('u1', UUID);
  });
});
