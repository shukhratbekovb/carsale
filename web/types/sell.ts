import type { Condition, DealRatingLabel, DriveType, FuelType, Transmission } from './listing';

// Типы для мастера размещения объявления (FE-3, FR-02 «Размещение объявления»,
// FR-03 «Авто-блюр госномера/VIN», FR-05 «Deal Rating»). Отдельные от Listing:
// черновик хранит промежуточные UI-состояния (жизненный цикл фото/блюра, статус
// live-оценки цены), которых нет и не должно быть в уже опубликованном объявлении.

export type WizardStep = 'VEHICLE_DETAILS' | 'PHOTOS' | 'PRICE' | 'REVIEW';

export const WIZARD_STEPS: WizardStep[] = ['VEHICLE_DETAILS', 'PHOTOS', 'PRICE', 'REVIEW'];

// Нормализованный прямоугольник (0..1 по каждой оси) — не зависит от пиксельных
// размеров исходного фото, UI позиционирует overlay-рамку в процентах от контейнера.
export interface BlurRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Жизненный цикл одного фото в мастере: локальный превью → идёт CV-детекция блюра
// → блюр применён (с найденными областями) / детекция не удалась. Discriminated
// union по status — чтобы UI мог делать исчерпывающий switch без приведения типов.
export type PhotoDraft =
  | { id: string; status: 'UPLOADING'; previewUrl: string }
  | { id: string; status: 'BLUR_PENDING'; previewUrl: string }
  | {
      id: string;
      status: 'BLUR_DONE';
      previewUrl: string;
      detectedRegions: BlurRegion[];
      // Ручная корректировка продавцом (FR-03 acceptance criteria: «продавец может
      // вручную скорректировать область блюра»). Если не задана — UI использует
      // detectedRegions как есть.
      manualRegions?: BlurRegion[];
    }
  | { id: string; status: 'BLUR_FAILED'; previewUrl: string; error?: string };

// Те же 4 состояния Deal Rating, что и у статичного бейджа каталога
// (DealRatingLabel из types/listing.ts) — переиспользуем, не изобретаем новые
// (frontend-plan.md FE-3 требует «PriceEstimateWidget со всеми 4 состояниями Deal
// Rating»). IDLE/LOADING дополнительно нужны живому виджету продавца, которых нет
// у статичного бейджа каталога, читающего уже посчитанный Listing.dealRating.
export type PriceEstimateState =
  | { status: 'IDLE' }
  | { status: 'LOADING' }
  | { status: 'LOADED'; label: DealRatingLabel; recommendedMin?: number; recommendedMax?: number }
  // Сбой самого запроса (сеть/сервис недоступен) — намеренно отдельно от LOADED с
  // label UNAVAILABLE: UNAVAILABLE означает «модель отработала, но не дала вердикт»
  // (например, недостаточно похожих объявлений), а не «запрос не выполнился». UI
  // должен предлагать повтор запроса только для FAILED.
  | { status: 'FAILED'; error?: string };

// Поля шага «характеристики авто» (FR-02: марка/модель/год, пробег, состояние,
// цвет, тип КПП/привода, двигатель, цена). Все поля опциональны в самом черновике —
// обязательность и границы значений проверяются отдельно, через vehicleDetailsSchema
// (lib/validation/sell.ts) при сабмите шага, а не через этот тип.
export type VehicleDetailsDraft = Partial<{
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  condition: Condition;
  color: string;
  transmission: Transmission;
  driveType: DriveType;
  engineVolume: number;
  fuelType: FuelType;
  city: string;
  priceUzs: number;
}>;

export interface ListingDraft {
  vehicle: VehicleDetailsDraft;
  description?: string;
  // До 20 фото (FR-02 acceptance criteria) — см. MAX_LISTING_PHOTOS в
  // lib/validation/sell.ts, где живёт числовое ограничение.
  photos: PhotoDraft[];
  priceEstimate: PriceEstimateState;
}

export type SubmissionState =
  | { status: 'NOT_SUBMITTED' }
  // FR-02: объявление уходит на модерацию, решение — обычно ≤ 30 мин. Реального
  // бэкенда пока нет, поэтому фронт хранит только сам факт «отправлено» + момент
  // отправки — этого достаточно, чтобы UI показал статус «на модерации».
  | { status: 'PENDING_MODERATION'; submittedAt: number };

export interface WizardFlowState {
  step: WizardStep;
  draft: ListingDraft;
  // Отмечается после успешной валидации формы шага в UI (RHF resolver прошёл).
  // Reducer сам не валидирует данные — только блокирует навигацию по этим флагам,
  // поэтому UI может легко спросить «шаг X завершён?» без повторного парсинга формы.
  completedSteps: Record<WizardStep, boolean>;
  submission: SubmissionState;
}
