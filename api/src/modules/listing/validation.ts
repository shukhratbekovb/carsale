import { z } from 'zod';

// Контракт совпадает с web/lib/validation/sell.ts (createVehicleDetailsSchema):
// полный набор характеристик при создании черновика. driveType — публичное '4WD'
// (маппинг в Prisma FOUR_WD — в repository).
const CONDITION = ['NEW', 'GOOD', 'FAIR', 'POOR'] as const;
const TRANSMISSION = ['AUTOMATIC', 'MANUAL', 'CVT', 'ROBOT'] as const;
const DRIVE_TYPE = ['FWD', 'RWD', 'AWD', '4WD'] as const;
const FUEL_TYPE = ['PETROL', 'DIESEL', 'GAS', 'ELECTRIC', 'HYBRID'] as const;

const MIN_YEAR = 1980;
const CURRENT_YEAR = new Date().getFullYear();
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_LISTING_PHOTOS = 20;

export const draftSchema = z.object({
  make: z.string().trim().min(1).max(64),
  model: z.string().trim().min(1).max(128),
  year: z.coerce.number().int().min(MIN_YEAR).max(CURRENT_YEAR + 1),
  mileageKm: z.coerce.number().int().min(0).max(999_999),
  condition: z.enum(CONDITION),
  color: z.string().trim().min(1).max(32).optional(),
  transmission: z.enum(TRANSMISSION),
  driveType: z.enum(DRIVE_TYPE),
  engineVolume: z.coerce.number().min(0.5).max(10).optional(),
  fuelType: z.enum(FUEL_TYPE).optional(),
  city: z.string().trim().min(1).max(64),
  priceUzs: z.coerce.number().int().positive(),
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
});

// Обновление — частичное; при этом должен остаться хотя бы один изменяемый ключ
export const updateSchema = draftSchema.partial().refine((obj) => Object.keys(obj).length > 0, {
  message: 'At least one field is required',
});

export type DraftInput = z.infer<typeof draftSchema>;
export type UpdateInput = z.infer<typeof updateSchema>;
