import { z } from 'zod';

// Ровно 3 типа из FR-11 / web/types/notification.ts. Полная замена prefs (per-type toggle).
export const preferencesSchema = z.object({
  NEW_MESSAGE: z.boolean(),
  PRICE_DROP: z.boolean(),
  LISTING_STATUS: z.boolean(),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;
