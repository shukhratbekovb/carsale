import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Rate-limit смонтирован глобально (BE-0.7); в юнит-тесте отключаем его Redis —
// fail-open, чтобы app.test не зависел от инфраструктуры.
vi.mock('./lib/redis.js', () => ({
  isRedisConfigured: () => false,
  getRedis: () => {
    throw new Error('redis disabled in app.test');
  },
}));

import { createApp } from './app.js';

describe('core-api scaffold', () => {
  const app = createApp();

  it('GET /health отвечает 200 со статусом сервиса', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'core-api' });
  });

  it('все 8 модулей реализованы (заглушек не осталось): /me гейтит по auth → 401', async () => {
    // BE-9 закрыл последнюю заглушку (user). Проба: authed-роут без токена → 401,
    // а не 501 not_implemented (модуль смонтирован и работает).
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'unauthorized' });
  });

  it('неизвестный маршрут отвечает 404 в едином формате ошибки', async () => {
    const res = await request(app).get('/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'not_found' });
  });

  it('прокидывает и генерирует X-Request-ID (NFR-27)', async () => {
    const echoed = await request(app).get('/health').set('X-Request-ID', 'trace-123');
    expect(echoed.headers['x-request-id']).toBe('trace-123');

    const generated = await request(app).get('/health');
    expect(generated.headers['x-request-id']).toBeTruthy();
  });
});
