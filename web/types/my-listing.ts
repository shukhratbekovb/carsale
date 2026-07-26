import type { DealRatingLabel } from '@/types/listing';

// Объявление продавца в личном кабинете (§5). Форма = Core `GET /my/listings`
// (api MyListing): включает статус модерации и флаги, в отличие от публичной
// PublicListing. Диапазон рекомендованной цены здесь не нужен (это список-обзор).
export type ListingStatus =
  | 'DRAFT'
  | 'PENDING_MODERATION'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED'
  | 'SOLD'
  | 'EXPIRED';

export interface SellerListing {
  id: string;
  status: ListingStatus;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  priceUzs: number;
  city: string;
  dealRatingLabel: DealRatingLabel | null;
  mileageFlag: boolean;
  fraudFlag: boolean;
  createdAt: string;
  updatedAt: string;
}
