import type {
  Condition,
  DealRatingLabel,
  DriveType,
  FuelType,
  Transmission,
} from '@/types/listing';

// Единый источник русскоязычных подписей для enum-полей объявления —
// переиспользуется в фильтрах каталога, бейдже Deal Rating и карточке объявления.
export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  AUTOMATIC: 'Автомат',
  MANUAL: 'Механика',
  CVT: 'Вариатор',
  ROBOT: 'Робот',
};

export const DRIVE_TYPE_LABELS: Record<DriveType, string> = {
  FWD: 'Передний',
  RWD: 'Задний',
  AWD: 'Полный (AWD)',
  '4WD': 'Полный (4WD)',
};

// PRD §5.3: цветовой индикатор + текстовая метка, без голой иконки без пояснения.
export const DEAL_RATING_LABELS: Record<DealRatingLabel, string> = {
  GREAT_DEAL: 'Отличная сделка',
  FAIR_PRICE: 'Честная цена',
  OVERPRICED: 'Завышенная цена',
  UNAVAILABLE: 'Оценка недоступна',
};

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: 'Новое',
  GOOD: 'Хорошее',
  FAIR: 'Среднее',
  POOR: 'Плохое',
};

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  PETROL: 'Бензин',
  DIESEL: 'Дизель',
  GAS: 'Газ',
  ELECTRIC: 'Электро',
  HYBRID: 'Гибрид',
};
