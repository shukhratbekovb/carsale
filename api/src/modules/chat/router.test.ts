import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({ env: { NODE_ENV: 'test', JWT_SECRET: 'test-jwt-secret' } }));

const svc = vi.hoisted(() => ({
  findOrCreateThread: vi.fn(),
  listThreads: vi.fn(),
  getThread: vi.fn(),
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  markRead: vi.fn(),
}));
vi.mock('./service.js', () => svc);

import { signAccessToken } from '../../lib/jwt.js';
import { errorHandler, notFoundHandler } from '../../middleware/error-handler.js';
import { chatRouter } from './router.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/chat', chatRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const UUID = '11111111-1111-1111-1111-111111111111';
const token = signAccessToken('user-1', 'BUYER');
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

describe('chat router (BE-5.1/5.4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /chat/threads без токена → 401', async () => {
    const res = await request(app).post('/chat/threads').send({ listingId: UUID });
    expect(res.status).toBe(401);
  });

  it('POST /chat/threads невалидный listingId → 400', async () => {
    const res = await auth(request(app).post('/chat/threads')).send({ listingId: 'nope' });
    expect(res.status).toBe(400);
  });

  it('POST /chat/threads создан → 201, существующий → 200', async () => {
    svc.findOrCreateThread.mockResolvedValueOnce({ thread: { id: 't1' }, created: true });
    const created = await auth(request(app).post('/chat/threads')).send({ listingId: UUID });
    expect(created.status).toBe(201);
    expect(svc.findOrCreateThread).toHaveBeenCalledWith('user-1', UUID);

    svc.findOrCreateThread.mockResolvedValueOnce({ thread: { id: 't1' }, created: false });
    const existing = await auth(request(app).post('/chat/threads')).send({ listingId: UUID });
    expect(existing.status).toBe(200);
  });

  it('GET /chat/threads → 200 { items }', async () => {
    svc.listThreads.mockResolvedValue([{ id: 't1' }]);
    const res = await auth(request(app).get('/chat/threads'));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('GET /chat/threads/:id/messages → 200 { items }', async () => {
    svc.getMessages.mockResolvedValue([{ id: 'm1' }]);
    const res = await auth(request(app).get(`/chat/threads/${UUID}/messages`));
    expect(res.status).toBe(200);
    expect(svc.getMessages).toHaveBeenCalledWith(UUID, 'user-1');
  });

  it('POST /chat/threads/:id/messages валидно → 201', async () => {
    svc.sendMessage.mockResolvedValue({ id: 'm1', text: 'hi' });
    const res = await auth(request(app).post(`/chat/threads/${UUID}/messages`)).send({ text: 'hi' });
    expect(res.status).toBe(201);
    expect(svc.sendMessage).toHaveBeenCalledWith(UUID, 'user-1', 'hi');
  });

  it('POST /chat/threads/:id/messages пустой текст → 400', async () => {
    const res = await auth(request(app).post(`/chat/threads/${UUID}/messages`)).send({ text: '   ' });
    expect(res.status).toBe(400);
    expect(svc.sendMessage).not.toHaveBeenCalled();
  });

  it('POST /chat/threads/:id/read → 204', async () => {
    svc.markRead.mockResolvedValue(undefined);
    const res = await auth(request(app).post(`/chat/threads/${UUID}/read`));
    expect(res.status).toBe(204);
  });

  it('non-uuid threadId → 404', async () => {
    const res = await auth(request(app).get('/chat/threads/garbage/messages'));
    expect(res.status).toBe(404);
  });
});
