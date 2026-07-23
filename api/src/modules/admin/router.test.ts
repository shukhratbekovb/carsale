import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'test', JWT_SECRET: 'test-jwt-secret' } }));

const svc = vi.hoisted(() => ({
  getModerationQueue: vi.fn(),
  getModerationItem: vi.fn(),
  approveListing: vi.fn(),
  rejectListing: vi.fn(),
  getUsers: vi.fn(),
  setUserStatus: vi.fn(),
  getAnalytics: vi.fn(),
}));
vi.mock('./service.js', () => svc);

import { signAccessToken } from '../../lib/jwt.js';
import { errorHandler, notFoundHandler } from '../../middleware/error-handler.js';
import { adminRouter } from './router.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const UUID = '11111111-1111-1111-1111-111111111111';
const adminToken = signAccessToken('admin-1', 'ADMIN');
const buyerToken = signAccessToken('buyer-1', 'BUYER');
const asAdmin = (r: request.Test) => r.set('Authorization', `Bearer ${adminToken}`);

describe('admin router (BE-8, RBAC)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('без токена → 401', async () => {
    const res = await request(app).get('/admin/moderation');
    expect(res.status).toBe(401);
  });

  it('не-ADMIN (BUYER) → 403', async () => {
    const res = await request(app).get('/admin/moderation').set('Authorization', `Bearer ${buyerToken}`);
    expect(res.status).toBe(403);
    expect(svc.getModerationQueue).not.toHaveBeenCalled();
  });

  it('GET /admin/moderation (ADMIN) → 200 { items }', async () => {
    svc.getModerationQueue.mockResolvedValue([{ id: 'l1' }]);
    const res = await asAdmin(request(app).get('/admin/moderation'));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('POST /moderation/:id/approve → 200', async () => {
    svc.approveListing.mockResolvedValue({ status: 'PUBLISHED' });
    const res = await asAdmin(request(app).post(`/admin/moderation/${UUID}/approve`));
    expect(res.status).toBe(200);
    expect(svc.approveListing).toHaveBeenCalledWith(UUID);
  });

  it('POST /moderation/:id/reject без причины → 400', async () => {
    const res = await asAdmin(request(app).post(`/admin/moderation/${UUID}/reject`)).send({});
    expect(res.status).toBe(400);
    expect(svc.rejectListing).not.toHaveBeenCalled();
  });

  it('POST /moderation/:id/reject валидно → 200', async () => {
    svc.rejectListing.mockResolvedValue({ status: 'REJECTED' });
    const res = await asAdmin(request(app).post(`/admin/moderation/${UUID}/reject`)).send({ reason: 'DUPLICATE' });
    expect(res.status).toBe(200);
    expect(svc.rejectListing).toHaveBeenCalledWith(UUID, { reason: 'DUPLICATE' });
  });

  it('POST /moderation/:id/approve не-uuid → 404', async () => {
    const res = await asAdmin(request(app).post('/admin/moderation/garbage/approve'));
    expect(res.status).toBe(404);
  });

  it('PUT /users/:id/status валидно → 200', async () => {
    svc.setUserStatus.mockResolvedValue({ id: UUID, status: 'BANNED' });
    const res = await asAdmin(request(app).put(`/admin/users/${UUID}/status`)).send({ status: 'BANNED' });
    expect(res.status).toBe(200);
    expect(svc.setUserStatus).toHaveBeenCalledWith(UUID, 'BANNED');
  });

  it('PUT /users/:id/status невалидный статус → 400', async () => {
    const res = await asAdmin(request(app).put(`/admin/users/${UUID}/status`)).send({ status: 'DELETED' });
    expect(res.status).toBe(400);
  });

  it('GET /admin/analytics → 200', async () => {
    svc.getAnalytics.mockResolvedValue({ totalListings: 5 });
    const res = await asAdmin(request(app).get('/admin/analytics'));
    expect(res.status).toBe(200);
    expect(res.body.totalListings).toBe(5);
  });
});
