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

// Копирайт мастера размещения объявления (FE-3, FR-02/03/05, см. §9 плана).
export const SELL_LABELS = {
  pageTitle: 'Разместить объявление',
  stepTitles: {
    VEHICLE_DETAILS: 'Характеристики',
    PHOTOS: 'Фотографии',
    PRICE: 'Оценка цены',
    REVIEW: 'Проверка и публикация',
  } as Record<'VEHICLE_DETAILS' | 'PHOTOS' | 'PRICE' | 'REVIEW', string>,
  back: 'Назад',
  next: 'Далее',
  submit: 'Опубликовать',
  submitting: 'Отправка...',

  makeLabel: 'Марка',
  modelLabel: 'Модель',
  yearLabel: 'Год выпуска',
  mileageLabel: 'Пробег, км',
  conditionLabel: 'Состояние',
  colorLabel: 'Цвет',
  transmissionLabel: 'Коробка передач',
  driveTypeLabel: 'Привод',
  engineVolumeLabel: 'Объём двигателя, л',
  fuelTypeLabel: 'Тип топлива',
  cityLabel: 'Город',
  priceLabel: 'Цена, UZS',
  selectPlaceholder: 'Выберите',

  photosHint: (max: number) => `До ${max} фото. Госномер и VIN замазываются автоматически.`,
  addPhotos: 'Добавить фото',
  photoRemove: 'Удалить',
  photoBlurPending: 'Определяем номер и VIN...',
  photoBlurDone: 'Номер и VIN замазаны',
  photoBlurFailed: 'Не удалось определить область для блюра',
  photoBlurRetry: 'Повторить',
  photoAdjustBlur: 'Скорректировать область блюра',
  photoBlurRegionLabel: (index: number) => `Область ${index + 1} (X, Y, ширина, высота в % от фото)`,

  descriptionLabel: 'Описание',
  descriptionPlaceholder: 'Расскажите об автомобиле: комплектация, история обслуживания, состояние...',

  priceEstimateLoading: 'Оцениваем справедливую цену...',
  priceEstimateFailed: 'Не удалось получить оценку цены',
  priceEstimateRetry: 'Повторить',
  priceEstimateRecommended: (min: number, max: number) =>
    `Рекомендованный диапазон: ${min.toLocaleString('ru-RU')} – ${max.toLocaleString('ru-RU')} UZS`,

  reviewVehicleTitle: 'Характеристики',
  reviewPhotosTitle: (count: number) => `Фото (${count})`,
  reviewPriceTitle: 'Оценка цены',
  reviewEdit: 'Изменить',

  submittedTitle: 'Объявление отправлено на модерацию',
  submittedMessage: 'Обычно проверка занимает не более 30 минут. Мы уведомим вас, когда объявление опубликуется.',
  backToCatalog: 'В каталог',
};
