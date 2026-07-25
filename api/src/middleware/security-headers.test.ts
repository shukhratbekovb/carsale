import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { securityHeaders } from './security-headers.js';

function app() {
  const a = express();
  a.use(securityHeaders);
  a.get('/x', (_req, res) => res.json({ ok: true }));
  return a;
}

describe('securityHeaders (BE-10.5, NFR-12)', () => {
  it('ставит все заголовки безопасности на ответ', async () => {
    const res = await request(app()).get('/x');
    expect(res.status).toBe(200);
    expect(res.headers['strict-transport-security']).toContain('max-age=63072000');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(res.headers['x-permitted-cross-domain-policies']).toBe('none');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'");
  });
});
