import type { Prisma, VerificationStatus } from '@prisma/client';
import { publicListingSelect, toPublicListing, type PublicListing } from '../catalog/mapper.js';

/**
 * Проекции admin-панели (BE-8). Форма приближена к web/types/admin.ts
 * (ModerationItem, AdminUserRecord). Осознанные отличия от фронт-мока
 * задокументированы ниже — они следствие того, что бэкенд ещё не хранит
 * соответствующие данные (не расхождение контракта, а его честный срез):
 *   • fraudFlag — сырой boolean+reason листинга, НЕ discriminated union
 *     (DUPLICATE_PHOTOS.originalId / PRICE_ANOMALY.percent): структурные
 *     доказательства фрода производит ML (BE-2.5/2.6) + consumer BE-3.6 — их ещё нет;
 *   • seller.name — у User нет поля имени (минимизация PII, имя даёт OneID P1;
 *     тот же пробел, что в chat BE-5.1);
 *   • phone — raw-номер не хранится (только HMAC-хеш, NFR-15), поэтому даже
 *     маскированный хвост недоступен → полностью маскированный плейсхолдер;
 *   • flaggedAt — нет отдельной метки входа в очередь → listing.createdAt.
 */

// Снапшот листинга (переиспользуем публичную проекцию каталога) + fraud-поля,
// статус и расширенный seller для карточки модерации.
export const moderationSelect = {
  ...publicListingSelect,
  status: true,
  fraudFlag: true,
  fraudReason: true,
  seller: { select: { id: true, verificationStatus: true, createdAt: true } },
} satisfies Prisma.ListingSelect;

export type ModerationRow = Prisma.ListingGetPayload<{ select: typeof moderationSelect }>;

export interface ModerationSeller {
  id: string;
  verified: boolean;
  registeredAt: string;
  activeListings: number;
  previousRejections: number;
}

export interface ModerationItem {
  id: string;
  listing: PublicListing;
  seller: ModerationSeller;
  fraudFlag: boolean;
  fraudReason: string | null;
  status: string;
  flaggedAt: string;
}

export interface SellerCounts {
  active: number;
  rejected: number;
}

export function toModerationItem(row: ModerationRow, counts: SellerCounts): ModerationItem {
  return {
    id: row.id,
    listing: toPublicListing(row),
    seller: {
      id: row.seller.id,
      verified: row.seller.verificationStatus === 'IDENTITY_VERIFIED',
      registeredAt: row.seller.createdAt.toISOString(),
      activeListings: counts.active,
      previousRejections: counts.rejected,
    },
    fraudFlag: row.fraudFlag,
    fraudReason: row.fraudReason,
    status: row.status,
    flaggedAt: row.createdAt.toISOString(),
  };
}

// ── Users ────────────────────────────────────────────────────────────────────

export const adminUserSelect = {
  id: true,
  verificationStatus: true,
  createdAt: true,
  _count: { select: { listings: true } },
} satisfies Prisma.UserSelect;

export type AdminUserRow = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

export type AdminUserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export interface AdminUserRecord {
  id: string;
  phone: string;
  registeredAt: string;
  status: AdminUserStatus;
  verified: boolean;
  listingsCount: number;
}

/** verificationStatus → admin-статус: SUSPENDED/BANNED как есть, прочее → ACTIVE. */
export function toAdminStatus(vs: VerificationStatus): AdminUserStatus {
  if (vs === 'SUSPENDED') return 'SUSPENDED';
  if (vs === 'BANNED') return 'BANNED';
  return 'ACTIVE';
}

// Raw-номер не хранится (NFR-15) → маскированный плейсхолдер без хвоста.
const MASKED_PHONE = '+998 ** *** ** **';

export function toAdminUserRecord(row: AdminUserRow): AdminUserRecord {
  return {
    id: row.id,
    phone: MASKED_PHONE,
    registeredAt: row.createdAt.toISOString(),
    status: toAdminStatus(row.verificationStatus),
    verified: row.verificationStatus === 'IDENTITY_VERIFIED',
    listingsCount: row._count.listings,
  };
}
