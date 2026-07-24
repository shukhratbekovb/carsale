import { z } from 'zod';

// Отзыв/выдача маркетингового согласия (BE-9.1, PRD 7.2). Базовое ПД-согласие
// не отзывается через профиль (его отзыв = удаление аккаунта, BE-9.3).
export const consentsSchema = z.object({
  marketing: z.boolean(),
});

export type ConsentsInput = z.infer<typeof consentsSchema>;
