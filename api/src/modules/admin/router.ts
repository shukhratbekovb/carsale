import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { AppError } from '../../lib/errors.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  approveListing,
  getAnalytics,
  getModerationItem,
  getModerationQueue,
  getUsers,
  rejectListing,
  setUserStatus,
} from './service.js';
import { rejectSchema, userStatusSchema } from './validation.js';

/**
 * Admin Module (BE-8, UC-15/16/17). Все роуты — только роль ADMIN
 * (requireAuth → requireRole('ADMIN'), RBAC BE-1.5). Контракт данных —
 * web/lib/mock/admin.ts.
 */

const uuidSchema = z.string().uuid();
function id(raw: string, code = 'not_found'): string {
  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) throw new AppError(404, code, 'Not found');
  return parsed.data;
}

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

// GET /admin/moderation — очередь модерации (PENDING oldest-first)
adminRouter.get(
  '/moderation',
  asyncHandler(async (_req, res) => {
    res.json({ items: await getModerationQueue() });
  }),
);

// GET /admin/moderation/:id — карточка модерации
adminRouter.get(
  '/moderation/:id',
  asyncHandler(async (req, res) => {
    res.json(await getModerationItem(id(req.params.id ?? '', 'moderation_item_not_found')));
  }),
);

// POST /admin/moderation/:id/approve — одобрить → PUBLISHED + уведомление
adminRouter.post(
  '/moderation/:id/approve',
  asyncHandler(async (req, res) => {
    res.json(await approveListing(id(req.params.id ?? '', 'listing_not_found')));
  }),
);

// POST /admin/moderation/:id/reject — отклонить (обязательная причина) + уведомление
adminRouter.post(
  '/moderation/:id/reject',
  asyncHandler(async (req, res) => {
    const input = rejectSchema.parse(req.body);
    res.json(await rejectListing(id(req.params.id ?? '', 'listing_not_found'), input));
  }),
);

// GET /admin/users — список пользователей (маскированный телефон, BR-3)
adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    res.json({ items: await getUsers() });
  }),
);

// PUT /admin/users/:id/status — suspend/ban/restore (UC-16)
adminRouter.put(
  '/users/:id/status',
  asyncHandler(async (req, res) => {
    const { status } = userStatusSchema.parse(req.body);
    res.json(await setUserStatus(id(req.params.id ?? '', 'user_not_found'), status));
  }),
);

// GET /admin/analytics — счётчики платформы (UC-17)
adminRouter.get(
  '/analytics',
  asyncHandler(async (_req, res) => {
    res.json(await getAnalytics());
  }),
);
