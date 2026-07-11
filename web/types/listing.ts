// Публичная форма LISTING/VEHICLE/ML_RESULT из analysis/08-data-model.md,
// упрощённая для фронтенда. VIN и госномер не публикуются (BR-3, NFR-15).

export type DealRatingLabel = 'GREAT_DEAL' | 'FAIR_PRICE' | 'OVERPRICED' | 'UNAVAILABLE';
export type Transmission = 'AUTOMATIC' | 'MANUAL' | 'CVT' | 'ROBOT';
export type DriveType = 'FWD' | 'RWD' | 'AWD' | '4WD';
export type Condition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR';
export type FuelType = 'PETROL' | 'DIESEL' | 'GAS' | 'ELECTRIC' | 'HYBRID';

// Канонические списки значений enum-полей — единый источник для итерации
// опций фильтров/селектов и для z.enum в схемах валидации. Подписи к значениям
// живут в словарях messages/{uz,ru}.json (namespace `listing`).
export const DEAL_RATING_VALUES = ['GREAT_DEAL', 'FAIR_PRICE', 'OVERPRICED', 'UNAVAILABLE'] as const satisfies readonly DealRatingLabel[];
export const TRANSMISSION_VALUES = ['AUTOMATIC', 'MANUAL', 'CVT', 'ROBOT'] as const satisfies readonly Transmission[];
export const DRIVE_TYPE_VALUES = ['FWD', 'RWD', 'AWD', '4WD'] as const satisfies readonly DriveType[];
export const CONDITION_VALUES = ['NEW', 'GOOD', 'FAIR', 'POOR'] as const satisfies readonly Condition[];
export const FUEL_TYPE_VALUES = ['PETROL', 'DIESEL', 'GAS', 'ELECTRIC', 'HYBRID'] as const satisfies readonly FuelType[];

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
