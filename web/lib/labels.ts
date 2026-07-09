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

// Копирайт для потока входа: номер телефона → SMS OTP (FR-01, UC-03, см. §9 плана).
export const AUTH_LABELS = {
  loginTitle: 'Вход',
  otpTitle: 'Подтверждение кода',
  phoneLabel: 'Номер телефона',
  phonePlaceholder: '+998901234567',
  getCode: 'Получить код',
  sendingCode: 'Отправка...',
  codeLabel: 'Код из SMS',
  codeSentTo: (phone: string) => `Код отправлен на ${phone}`,
  confirm: 'Подтвердить',
  verifying: 'Проверка...',
  resend: 'Отправить повторно',
  resendIn: (seconds: number) => `Отправить повторно через ${seconds} с`,
  changePhone: 'Изменить номер',
  invalidCode: (attemptsRemaining: number) => `Неверный код. Осталось попыток: ${attemptsRemaining}`,
  smsUnavailable: 'Не удалось отправить SMS, попробуйте позже',
  lockedTitle: 'Слишком много попыток',
  lockedMessage: (time: string) => `Повторите через ${time}`,
};
