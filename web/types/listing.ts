// Публичная форма LISTING/VEHICLE/ML_RESULT из analysis/08-data-model.md,
// упрощённая для фронтенда. VIN и госномер не публикуются (BR-3, NFR-15).

export type DealRatingLabel = 'GREAT_DEAL' | 'FAIR_PRICE' | 'OVERPRICED' | 'UNAVAILABLE';

export interface DealRating {
  label: DealRatingLabel;
  recommendedMin?: number;
  recommendedMax?: number;
}

export interface Listing {
  id: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  priceUzs: number;
  city: string;
  dealRating: DealRating;
  mileageFlag: boolean;
  mileageFlagReason?: string;
  sellerVerified: boolean;
}
