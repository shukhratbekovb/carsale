import { z } from 'zod';
import { UZ_CITIES } from '@/lib/data/uz-cities';
import type { ValidationTranslator } from '@/lib/validation/translator';
import {
  CONDITION_VALUES,
  DRIVE_TYPE_VALUES,
  FUEL_TYPE_VALUES,
  TRANSMISSION_VALUES,
} from '@/types/listing';

// Zod-схемы мастера размещения объявления (FE-3, FR-02) — по одной на шаг, чтобы
// каждый шаг мог валидироваться независимо через свой RHF resolver, а не через
// одну гигантскую схему на весь черновик. Схемы — фабрики с переводчиком
// namespace'а validation (см. lib/validation/translator.ts): сообщения об
// ошибках локализуются вместе с остальным UI.

// Старше — единичные раритеты на рынке UZ, не типичный кейс маркетплейса.
const MIN_YEAR = 1980;
const CURRENT_YEAR = new Date().getFullYear();

// Ограничиваем город списком из uz-cities.ts, а не произвольной строкой —
// продавец выбирает из того же справочника, что использует каталог/фильтры.
const CITY_NAMES = UZ_CITIES.map((city) => city.name) as [string, ...string[]];

export function createVehicleDetailsSchema(t: ValidationTranslator) {
  return z.object({
    make: z.string().trim().min(1, t('makeRequired')),
    model: z.string().trim().min(1, t('modelRequired')),
    // Строка-сообщение у z.coerce.number()/z.enum() покрывает базовую проверку
    // типа: пустое число (undefined → NaN) и невыбранный <select> ('') иначе
    // падают в неперeводимый zod-дефолт "Invalid input".
    year: z.coerce
      .number(t('yearRequired'))
      .int(t('yearInt'))
      .min(MIN_YEAR, t('yearMin', { min: MIN_YEAR }))
      .max(CURRENT_YEAR + 1, t('yearMax', { max: CURRENT_YEAR + 1 })),
    mileageKm: z.coerce.number(t('mileageRequired')).int(t('mileageInt')).min(0, t('mileageNegative')),
    condition: z.enum(CONDITION_VALUES, t('conditionRequired')),
    color: z.string().trim().min(1).optional(),
    transmission: z.enum(TRANSMISSION_VALUES, t('transmissionRequired')),
    driveType: z.enum(DRIVE_TYPE_VALUES, t('driveTypeRequired')),
    engineVolume: z.coerce
      .number()
      .positive(t('engineVolumePositive'))
      .max(10, t('engineVolumeMax'))
      .optional(),
    fuelType: z.enum(FUEL_TYPE_VALUES).optional(),
    city: z.enum(CITY_NAMES, t('cityInvalid')),
    priceUzs: z.coerce.number(t('priceRequired')).positive(t('pricePositive')),
  });
}

export type VehicleDetailsInput = z.infer<ReturnType<typeof createVehicleDetailsSchema>>;

export const MAX_DESCRIPTION_LENGTH = 2000;

// Шаг «описание» сворачивается в REVIEW — под него нет отдельного WizardStep
// (см. types/sell.ts). Поле не обязательное, только ограничение длины.
export function createReviewSchema(t: ValidationTranslator) {
  return z.object({
    description: z
      .string()
      .trim()
      .max(MAX_DESCRIPTION_LENGTH, t('descriptionMax', { max: MAX_DESCRIPTION_LENGTH }))
      .optional(),
  });
}

export type ReviewInput = z.infer<ReturnType<typeof createReviewSchema>>;

// FR-02 acceptance criteria: обязательно хотя бы одно фото, максимум 20.
export const MAX_LISTING_PHOTOS = 20;

// Валидируем только количество фото (по их id) — содержимое самого PhotoDraft
// (статус блюра, области и т.д.) не является полем формы этого шага.
export function createPhotosSchema(t: ValidationTranslator) {
  return z.object({
    photoIds: z
      .array(z.string())
      .min(1, t('photosMin'))
      .max(MAX_LISTING_PHOTOS, t('photosMax', { max: MAX_LISTING_PHOTOS })),
  });
}

export type PhotosInput = z.infer<ReturnType<typeof createPhotosSchema>>;
