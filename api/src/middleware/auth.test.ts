import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: { NODE_ENV: 'test', JWT_SECRET: 'test-jwt-secret' },
}));

import { errorHandler } from './error-handler.js';
import { requireAuth, requireRole } from './auth.js';
import { signAccessToken } from '../lib/jwt.js';

function buildApp() {
  const app = express();
  app.get('/me', requireAuth, (_req, res) => {
    res.json({ auth: res.locals.auth });
  });
  app.get('/admin', requireAuth, requireRole('ADMIN'), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('requireAuth / requireRole (BE-1.5)', () => {
  const app = buildApp();
  const bearer = (t: string) => `Bearer ${t}`;

  it('без заголовка → 401 unauthorized', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('unauthorized');
  });

  it('битый токен → 401 invalid_token', async () => {
    const res = await request(app).get('/me').set('Authorization', bearer('garbage'));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('invalid_token');
  });

  it('валидный токен → пропускает и кладёт клеймы в res.locals.auth', async () => {
    const res = await request(app)
      .get('/me')
      .set('Authorization', bearer(signAccessToken('u1', 'BUYER')));
    expect(res.status).toBe(200);
    expect(res.body.auth).toMatchObject({ sub: 'u1', role: 'BUYER' });
  });

  it('requireRole: неподходящая роль → 403 forbidden', async () => {
    const res = await request(app)
      .get('/admin')
      .set('Authorization', bearer(signAccessToken('u1', 'BUYER')));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('forbidden');
  });

  it('requireRole: подходящая роль → 200', async () => {
    const res = await request(app)
      .get('/admin')
      .set('Authorization', bearer(signAccessToken('admin', 'ADMIN')));
    expect(res.status).toBe(200);
  });
});
