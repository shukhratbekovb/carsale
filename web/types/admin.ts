import type { Listing } from '@/types/listing';

// Admin-панель (FE-8, Epic 9): очередь модерации фрод-флагов (UC-15),
// управление пользователями suspend/ban (UC-16), базовая аналитика (UC-17).
// Упрощённый срез FRAUD_FLAG/MODERATION-сущностей из
// docs/analysis/08-data-model.md — ровно то, что нужно карточке модератора.
// Подписи ко всем enum-значениям живут в словарях messages/{uz,ru}.json,
// здесь — только канонические ключи (тот же принцип, что в types/listing.ts).

export type FraudFlagType = 'DUPLICATE_PHOTOS' | 'PRICE_ANOMALY';

export const FRAUD_FLAG_TYPE_VALUES = [
  'DUPLICATE_PHOTOS',
  'PRICE_ANOMALY',
] as const satisfies readonly FraudFlagType[];

// Discriminated union по type: у каждого вида флага свой доказательный
// контекст для модератора (UC-15 шаг 3) — ссылка на оригинал при дубликатах
// фото, процент отклонения цены при ценовой аномалии.
export interface DuplicatePhotosFlag {
  type: 'DUPLICATE_PHOTOS';
  // id оригинального объявления в публичном каталоге (mockListings),
  // фото которого продублированы во флагнутом объявлении.
  duplicateOfListingId: string;
}

export interface PriceAnomalyFlag {
  type: 'PRICE_ANOMALY';
  // Процент отклонения цены вниз от рыночной оценки (35 = «на 35% дешевле
  // рынка») — подозрительно низкая цена как признак скама.
  deviationPercent: number;
}

export type FraudFlag = DuplicatePhotosFlag | PriceAnomalyFlag;

export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export const MODERATION_STATUS_VALUES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
] as const satisfies readonly ModerationStatus[];

export type RejectReason = 'DUPLICATE' | 'FRAUD_PRICE' | 'MISLEADING_INFO' | 'OTHER';

export const REJECT_REASON_VALUES = [
  'DUPLICATE',
  'FRAUD_PRICE',
  'MISLEADING_INFO',
  'OTHER',
] as const satisfies readonly RejectReason[];

// Срез профиля продавца для карточки модерации (UC-15 шаг 3: модератор видит
// историю продавца и статус верификации, прежде чем принять решение).
export interface SellerProfile {
  id: string;
  name: string;
  registeredAt: string;
  verified: boolean;
  activeListings: number;
  previousRejections: number;
}

export interface ModerationDecision {
  decidedAt: string;
  // Только для REJECTED — причина обязательна по UC-15 (продавец получает
  // уведомление с причиной отклонения).
  rejectReason?: RejectReason;
  comment?: string;
}

export interface ModerationItem {
  id: string;
  // Снапшот объявления: флагнутые объявления скрыты из публичного каталога
  // до решения модератора, поэтому это отдельные Listing, не из mockListings.
  listing: Listing;
  fraudFlag: FraudFlag;
  seller: SellerProfile;
  status: ModerationStatus;
  flaggedAt: string;
  decision?: ModerationDecision;
}

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export const USER_STATUS_VALUES = [
  'ACTIVE',
  'SUSPENDED',
  'BANNED',
] as const satisfies readonly UserStatus[];

export interface AdminUserRecord {
  id: string;
  name: string;
  // Маскированный вид `+998 ** *** ** 45` — телефоны, как и VIN,
  // не публикуются даже в админке в открытом виде (BR-3, NFR-15).
  phone: string;
  registeredAt: string;
  status: UserStatus;
  verified: boolean;
  listingsCount: number;
}

// Базовая аналитика платформы (UC-17): счётчики объявлений/пользователей.
export interface PlatformAnalytics {
  totalListings: number;
  activeListings: number;
  pendingModeration: number;
  rejectedListings: number;
  totalUsers: number;
  // MAU — активные пользователи за 30 дней.
  activeUsers30d: number;
  newListings7d: number;
  newUsers7d: number;
}
