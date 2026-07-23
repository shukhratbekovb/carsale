import { z } from 'zod';

/**
 * Валидация admin-действий (BE-8). Контракт значений — web/types/admin.ts:
 * причины отклонения (REJECT_REASON_VALUES) и целевые статусы пользователя
 * (USER_STATUS_VALUES).
 */

export const rejectSchema = z.object({
  reason: z.enum(['DUPLICATE', 'FRAUD_PRICE', 'MISLEADING_INFO', 'OTHER']),
  comment: z.string().trim().max(512).optional(),
});
export type RejectInput = z.infer<typeof rejectSchema>;

// setUserStatus принимает только целевые действия модерации (не любой
// verificationStatus): ACTIVE = снять ограничение, SUSPENDED/BANNED — наложить.
export const userStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
});
export type UserStatusInput = z.infer<typeof userStatusSchema>;
