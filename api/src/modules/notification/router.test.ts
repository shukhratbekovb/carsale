import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'test', JWT_SECRET: 'test-jwt-secret' } }));

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  markAllRead: vi.fn(),
  getPreferences: vi.fn(),
  setPreferences: vi.fn(),
  getVapidPublicKey: vi.fn(),
  subscribePush: vi.fn(),
  unsubscribePush: vi.fn(),
}));
vi.mock('./service.js', () => svc);

import { signAccessToken } from '../../lib/jwt.js';
import { errorHandler, notFoundHandler } from '../../middleware/error-handler.js';
import { notificationRouter } from './router.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/notifications', notificationRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const token = signAccessToken('u1', 'BUYER');
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
const VALID_SUB = { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'p', auth: 'a' } };

describe('notification router push (BE-7.3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /push/vapid-key → 200 { publicKey } (без auth)', async () => {
    svc.getVapidPublicKey.mockReturnValue('BPUBLIC');
    const res = await request(app).get('/notifications/push/vapid-key');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ publicKey: 'BPUBLIC' });
  });

  it('POST /push/subscribe без токена → 401', async () => {
    const res = await request(app).post('/notifications/push/subscribe').send(VALID_SUB);
    expect(res.status).toBe(401);
    expect(svc.subscribePush).not.toHaveBeenCalled();
  });

  it('POST /push/subscribe невалидное тело → 400', async () => {
    const res = await auth(request(app).post('/notifications/push/subscribe')).send({ endpoint: 'not-a-url' });
    expect(res.status).toBe(400);
    expect(svc.subscribePush).not.toHaveBeenCalled();
  });

  it('POST /push/subscribe валидно → 201, userId из токена', async () => {
    svc.subscribePush.mockResolvedValue(undefined);
    const res = await auth(request(app).post('/notifications/push/subscribe')).send(VALID_SUB);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ subscribed: true });
    expect(svc.subscribePush).toHaveBeenCalledWith('u1', VALID_SUB);
  });

  it('POST /push/unsubscribe валидно → 204', async () => {
    svc.unsubscribePush.mockResolvedValue(undefined);
    const res = await auth(request(app).post('/notifications/push/unsubscribe')).send({ endpoint: 'https://fcm.googleapis.com/x' });
    expect(res.status).toBe(204);
    expect(svc.unsubscribePush).toHaveBeenCalledWith('https://fcm.googleapis.com/x');
  });
});
