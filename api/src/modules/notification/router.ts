import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import {
  getPreferences,
  getVapidPublicKey,
  list,
  markAllRead,
  setPreferences,
  subscribePush,
  unsubscribePush,
} from './service.js';
import { preferencesSchema, pushSubscriptionSchema } from './validation.js';
import { z } from 'zod';

/**
 * Notification REST (BE-7, FR-11). Лента in-app + per-type настройки.
 * Все роуты — только для текущего пользователя.
 */
export const notificationRouter = Router();

// GET /notifications — лента + счётчик непрочитанных (для bell)
notificationRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await list(getAuth(res).sub));
  }),
);

// POST /notifications/read — пометить все прочитанными
notificationRouter.post(
  '/read',
  requireAuth,
  asyncHandler(async (_req, res) => {
    await markAllRead(getAuth(res).sub);
    res.status(204).end();
  }),
);

// GET /notifications/preferences — текущие per-type настройки
notificationRouter.get(
  '/preferences',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await getPreferences(getAuth(res).sub));
  }),
);

// PUT /notifications/preferences — заменить настройки
notificationRouter.put(
  '/preferences',
  requireAuth,
  asyncHandler(async (req, res) => {
    const prefs = preferencesSchema.parse(req.body);
    res.json(await setPreferences(getAuth(res).sub, prefs));
  }),
);

// GET /notifications/push/vapid-key — публичный VAPID-ключ для подписки (BE-7.3)
notificationRouter.get(
  '/push/vapid-key',
  asyncHandler(async (_req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  }),
);

// POST /notifications/push/subscribe — зарегистрировать подписку браузера
notificationRouter.post(
  '/push/subscribe',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sub = pushSubscriptionSchema.parse(req.body);
    await subscribePush(getAuth(res).sub, sub);
    res.status(201).json({ subscribed: true });
  }),
);

// POST /notifications/push/unsubscribe — снять подписку по endpoint
notificationRouter.post(
  '/push/unsubscribe',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);
    await unsubscribePush(endpoint);
    res.status(204).end();
  }),
);
