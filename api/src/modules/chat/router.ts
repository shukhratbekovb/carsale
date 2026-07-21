import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { AppError } from '../../lib/errors.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import {
  findOrCreateThread,
  getMessages,
  getThread,
  listThreads,
  markRead,
  sendMessage,
} from './service.js';
import { createThreadSchema, sendMessageSchema } from './validation.js';

/**
 * Chat REST (BE-5.1/5.4, §6.4). Все роуты — только для участников треда.
 * Real-time push сообщений — WebSocket Hub (BE-5.2/5.3, следующий шаг).
 */
export const chatRouter = Router();

const idSchema = z.string().uuid();
function threadId(raw: string): string {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) throw new AppError(404, 'thread_not_found', 'Thread not found');
  return parsed.data;
}

// POST /chat/threads { listingId } — найти или создать тред (UC-06)
chatRouter.post(
  '/threads',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { listingId } = createThreadSchema.parse(req.body);
    const { thread, created } = await findOrCreateThread(getAuth(res).sub, listingId);
    res.status(created ? 201 : 200).json(thread);
  }),
);

// GET /chat/threads — инбокс текущего пользователя
chatRouter.get(
  '/threads',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ items: await listThreads(getAuth(res).sub) });
  }),
);

// GET /chat/threads/:id — один тред
chatRouter.get(
  '/threads/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getThread(threadId(req.params.id ?? ''), getAuth(res).sub));
  }),
);

// GET /chat/threads/:id/messages — история
chatRouter.get(
  '/threads/:id/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ items: await getMessages(threadId(req.params.id ?? ''), getAuth(res).sub) });
  }),
);

// POST /chat/threads/:id/messages { text } — отправить сообщение
chatRouter.post(
  '/threads/:id/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { text } = sendMessageSchema.parse(req.body);
    const message = await sendMessage(threadId(req.params.id ?? ''), getAuth(res).sub, text);
    res.status(201).json(message);
  }),
);

// POST /chat/threads/:id/read — пометить прочитанным (unread → 0)
chatRouter.post(
  '/threads/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    await markRead(threadId(req.params.id ?? ''), getAuth(res).sub);
    res.status(204).end();
  }),
);
