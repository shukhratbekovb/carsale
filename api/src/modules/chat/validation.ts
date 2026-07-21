import { z } from 'zod';

// Контракт §6.4 / web/lib/mock/chat.ts. Тред создаётся по объявлению, сообщение — текст.
export const MAX_MESSAGE_LENGTH = 2000;

export const createThreadSchema = z.object({
  listingId: z.string().uuid(),
});

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
