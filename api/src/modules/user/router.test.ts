import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'test', JWT_SECRET: 'test-jwt-secret' } }));

const svc = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateConsents: vi.fn(),
  exportData: vi.fn(),
  requestDeletion: vi.fn(),
}));
vi.mock('./service.js', () => svc);

import { signAccessToken } from '../../lib/jwt.js';
import { errorHandler, notFoundHandler } from '../../middleware/error-handler.js';
import { userRouter } from './router.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/me', userRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const token = signAccessToken('u1', 'BUYER');
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

describe('user router (BE-9)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /me без токена → 401', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
  });

  it('GET /me → 200 профиль', async () => {
    svc.getProfile.mockResolvedValue({ id: 'u1', phone: '+998 ** *** ** **' });
    const res = await auth(request(app).get('/me'));
    expect(res.status).toBe(200);
    expect(svc.getProfile).toHaveBeenCalledWith('u1');
  });

  it('PUT /me/consents невалидно → 400', async () => {
    const res = await auth(request(app).put('/me/consents')).send({ marketing: 'yes' });
    expect(res.status).toBe(400);
    expect(svc.updateConsents).not.toHaveBeenCalled();
  });

  it('PUT /me/consents валидно → 200, marketing из тела', async () => {
    svc.updateConsents.mockResolvedValue({ personalData: true, marketing: false });
    const res = await auth(request(app).put('/me/consents')).send({ marketing: false });
    expect(res.status).toBe(200);
    expect(svc.updateConsents).toHaveBeenCalledWith('u1', false);
  });

  it('GET /me/export → 200 + attachment-заголовок', async () => {
    svc.exportData.mockResolvedValue({ exportedAt: 'x', device: false });
    const res = await auth(request(app).get('/me/export'));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.device).toBe(false);
  });

  it('POST /me/delete → 200 квитанция', async () => {
    svc.requestDeletion.mockResolvedValue({ requestedAt: 'a', dueBy: 'b' });
    const res = await auth(request(app).post('/me/delete'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requestedAt: 'a', dueBy: 'b' });
    expect(svc.requestDeletion).toHaveBeenCalledWith('u1');
  });
});
