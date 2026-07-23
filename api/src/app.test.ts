import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('core-api scaffold', () => {
  const app = createApp();

  it('GET /health отвечает 200 со статусом сервиса', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'core-api' });
  });

  it('маршруты модулей-заглушек отвечают 501 в едином формате ошибки', async () => {
    // /me (user, BE-9) пока заглушка; auth/catalog/listing/chat/payment/notification/admin реализованы
    const res = await request(app).get('/me/profile');
    expect(res.status).toBe(501);
    expect(res.body).toMatchObject({ code: 'not_implemented' });
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
