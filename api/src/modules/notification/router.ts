import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { getPreferences, list, markAllRead, setPreferences } from './service.js';
import { preferencesSchema } from './validation.js';

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
