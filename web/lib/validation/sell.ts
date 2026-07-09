import { z } from 'zod';
import { UZ_CITIES } from '@/lib/data/uz-cities';

// Zod-схемы мастера размещения объявления (FE-3, FR-02) — по одной на шаг, чтобы
// каждый шаг мог валидироваться независимо через свой RHF resolver, а не через
// одну гигантскую схему на весь черновик.

// Старше — единичные раритеты на рынке UZ, не типичный кейс маркетплейса.
const MIN_YEAR = 1980;
const CURRENT_YEAR = new Date().getFullYear();

const CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR'] as const;
const TRANSMISSIONS = ['AUTOMATIC', 'MANUAL', 'CVT', 'ROBOT'] as const;
const DRIVE_TYPES = ['FWD', 'RWD', 'AWD', '4WD'] as const;
const FUEL_TYPES = ['PETROL', 'DIESEL', 'GAS', 'ELECTRIC', 'HYBRID'] as const;

// Ограничиваем город списком из uz-cities.ts, а не произвольной строкой —
// продавец выбирает из того же справочника, что использует каталог/фильтры.
const CITY_NAMES = UZ_CITIES.map((city) => city.name) as [string, ...string[]];

export const vehicleDetailsSchema = z.object({
  make: z.string().trim().min(1, 'Укажите марку'),
  model: z.string().trim().min(1, 'Укажите модель'),
  year: z.coerce
    .number()
    .int('Год должен быть целым числом')
    .min(MIN_YEAR, `Год не раньше ${MIN_YEAR}`)
    .max(CURRENT_YEAR + 1, `Год не позже ${CURRENT_YEAR + 1}`),
  mileageKm: z.coerce.number().int('Пробег должен быть целым числом').min(0, 'Пробег не может быть отрицательным'),
  condition: z.enum(CONDITIONS),
  color: z.string().trim().min(1).optional(),
  transmission: z.enum(TRANSMISSIONS),
  driveType: z.enum(DRIVE_TYPES),
  engineVolume: z.coerce
    .number()
    .positive('Объём двигателя должен быть больше нуля')
    .max(10, 'Проверьте объём двигателя')
    .optional(),
  fuelType: z.enum(FUEL_TYPES).optional(),
  city: z.enum(CITY_NAMES, 'Выберите город из списка'),
  priceUzs: z.coerce.number().positive('Цена должна быть больше нуля'),
});

export type VehicleDetailsInput = z.infer<typeof vehicleDetailsSchema>;

export const MAX_DESCRIPTION_LENGTH = 2000;

// Шаг «описание» сворачивается в REVIEW — под него нет отдельного WizardStep
// (см. types/sell.ts). Поле не обязательное, только ограничение длины.
export const reviewSchema = z.object({
  description: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH, `Описание не длиннее ${MAX_DESCRIPTION_LENGTH} символов`)
    .optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

// FR-02 acceptance criteria: обязательно хотя бы одно фото, максимум 20.
export const MAX_LISTING_PHOTOS = 20;

// Валидируем только количество фото (по их id) — содержимое самого PhotoDraft
// (статус блюра, области и т.д.) не является полем формы этого шага.
export const photosSchema = z.object({
  photoIds: z
    .array(z.string())
    .min(1, 'Добавьте хотя бы одно фото')
    .max(MAX_LISTING_PHOTOS, `Максимум ${MAX_LISTING_PHOTOS} фото`),
});

export type PhotosInput = z.infer<typeof photosSchema>;
