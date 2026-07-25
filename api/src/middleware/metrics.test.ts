import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { registry } from '../lib/metrics.js';
import { metricsMiddleware } from './metrics.js';

function app() {
  const a = express();
  a.use(metricsMiddleware);
  a.get('/items/:id', (_req, res) => res.json({ ok: true }));
  a.get('/metrics', (_req, res) => {
    void registry.metrics().then((body) => {
      res.set('Content-Type', registry.contentType);
      res.end(body);
    });
  });
  return a;
}

describe('metricsMiddleware + /metrics (BE-10.4, NFR-26)', () => {
  it('пишет длительность запроса с нормализованным маршрутом-шаблоном', async () => {
    const a = app();
    await request(a).get('/items/abc123'); // сырой id → шаблон /items/:id

    const res = await request(a).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('http_request_duration_seconds');
    // маршрут нормализован в шаблон (не сырой /items/abc123 — защита кардинальности)
    expect(res.text).toMatch(/route="\/items\/:id"/);
    expect(res.text).toContain('method="GET"');
    expect(res.text).toContain('status_code="200"');
    expect(res.text).not.toContain('/items/abc123');
  });
});
