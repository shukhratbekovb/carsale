import { z } from 'zod';

// Ровно 3 типа из FR-11 / web/types/notification.ts. Полная замена prefs (per-type toggle).
export const preferencesSchema = z.object({
  NEW_MESSAGE: z.boolean(),
  PRICE_DROP: z.boolean(),
  LISTING_STATUS: z.boolean(),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

// Подписка Web Push из браузера (PushSubscription.toJSON(), BE-7.3).
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(512),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(128),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
