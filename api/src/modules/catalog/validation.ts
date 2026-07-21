import { z } from 'zod';

// Контракт совпадает с web/lib/catalog/filter-listings.ts (CatalogFilters + SortOption).
// Значения enum — публичные ('4WD', не Prisma-имя FOUR_WD); маппинг в repository.
const TRANSMISSION = ['AUTOMATIC', 'MANUAL', 'CVT', 'ROBOT'] as const;
const DRIVE_TYPE = ['FWD', 'RWD', 'AWD', '4WD'] as const;
const DEAL_RATING = ['GREAT_DEAL', 'FAIR_PRICE', 'OVERPRICED', 'UNAVAILABLE'] as const;
const SORT = ['date', 'price', 'dealRating'] as const;

export const MAX_PAGE_SIZE = 60;
export const DEFAULT_PAGE_SIZE = 20;

// Пустые query-строки трактуем как «не задано»
const optionalStr = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v));

export const listQuerySchema = z.object({
  q: optionalStr,
  make: optionalStr,
  model: optionalStr,
  city: optionalStr,
  yearMin: z.coerce.number().int().optional(),
  yearMax: z.coerce.number().int().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  mileageMin: z.coerce.number().int().optional(),
  mileageMax: z.coerce.number().int().optional(),
  transmission: z.enum(TRANSMISSION).optional(),
  driveType: z.enum(DRIVE_TYPE).optional(),
  dealRating: z.enum(DEAL_RATING).optional(),
  verifiedOnly: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  sort: z.enum(SORT).default('date'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
