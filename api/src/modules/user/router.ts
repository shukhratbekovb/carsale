import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { exportData, getProfile, requestDeletion, updateConsents } from './service.js';
import { consentsSchema } from './validation.js';

/**
 * User Module (BE-9, NFR-18–21, ЗРУ-547): профиль, согласия, экспорт данных,
 * удаление аккаунта. Все роуты — только текущий пользователь (requireAuth).
 * Контракт — web/lib/gdpr/**, но server-scope.
 */
export const userRouter = Router();

// GET /me — профиль + согласия
userRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await getProfile(getAuth(res).sub));
  }),
);

// PUT /me/consents — отзыв/выдача маркетингового согласия (PRD 7.2)
userRouter.put(
  '/consents',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { marketing } = consentsSchema.parse(req.body);
    res.json(await updateConsents(getAuth(res).sub, marketing));
  }),
);

// GET /me/export — серверный экспорт всех данных (NFR-20)
userRouter.get(
  '/export',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const data = await exportData(getAuth(res).sub);
    res
      .setHeader('Content-Disposition', 'attachment; filename="carsale-data-export.json"')
      .json(data);
  }),
);

// POST /me/delete — запрос удаления аккаунта (soft delete + анонимизация, NFR-21)
userRouter.post(
  '/delete',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json(await requestDeletion(getAuth(res).sub));
  }),
);
