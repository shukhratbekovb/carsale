// Публичная форма LISTING/VEHICLE/ML_RESULT из analysis/08-data-model.md,
// упрощённая для фронтенда. VIN и госномер не публикуются (BR-3, NFR-15).

export type DealRatingLabel = 'GREAT_DEAL' | 'FAIR_PRICE' | 'OVERPRICED' | 'UNAVAILABLE';
export type Transmission = 'AUTOMATIC' | 'MANUAL' | 'CVT' | 'ROBOT';
export type DriveType = 'FWD' | 'RWD' | 'AWD' | '4WD';
export type Condition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR';
export type FuelType = 'PETROL' | 'DIESEL' | 'GAS' | 'ELECTRIC' | 'HYBRID';

export interface DealRating {
  label: DealRatingLabel;
  // Числовой диапазон — только для продавца (FE-3, форма размещения).
  // Покупателю показывается исключительно метка (FR-09 acceptance criteria).
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
  transmission: Transmission;
  driveType: DriveType;
  condition: Condition;
  color?: string;
  engineVolume?: number;
  fuelType?: FuelType;
  description?: string;
  dealRating: DealRating;
  mileageFlag: boolean;
  mileageFlagReason?: string;
  sellerVerified: boolean;
  createdAt: string;
}
