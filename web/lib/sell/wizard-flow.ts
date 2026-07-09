import { MAX_LISTING_PHOTOS } from '@/lib/validation/sell';
import type {
  BlurRegion,
  ListingDraft,
  PhotoDraft,
  VehicleDetailsDraft,
  WizardFlowState,
  WizardStep,
} from '@/types/sell';
import { WIZARD_STEPS } from '@/types/sell';
import type { DealRatingLabel } from '@/types/listing';

// Чистые функции перехода состояний для мастера размещения объявления (FE-3,
// FR-02/03/05) — без побочных эффектов, время (`now`) всегда передаётся снаружи
// (см. конвенцию lib/auth/otp-flow.ts). Zod-валидация полей формы происходит в
// UI через RHF resolver на каждый шаг; этот reducer только хранит флаги
// «шаг завершён» и не даёт перейти вперёд, пока текущий шаг не завершён.

function createInitialDraft(): ListingDraft {
  return {
    vehicle: {},
    description: undefined,
    photos: [],
    priceEstimate: { status: 'IDLE' },
  };
}

export function createInitialDraftState(): WizardFlowState {
  return {
    step: 'VEHICLE_DETAILS',
    draft: createInitialDraft(),
    completedSteps: {
      VEHICLE_DETAILS: false,
      PHOTOS: false,
      PRICE: false,
      REVIEW: false,
    },
    submission: { status: 'NOT_SUBMITTED' },
  };
}

// ---- Навигация по шагам --------------------------------------------------

export function isStepComplete(state: WizardFlowState, step: WizardStep): boolean {
  return state.completedSteps[step];
}

export function areAllStepsComplete(state: WizardFlowState): boolean {
  return WIZARD_STEPS.every((step) => state.completedSteps[step]);
}

// Отмечает шаг завершённым/незавершённым. Вызывается UI после успешного (или
// после изменившего данные и требующего повторной валидации) прогона RHF resolver'а
// для этого шага — сам reducer данные не проверяет.
export function markStepComplete(
  state: WizardFlowState,
  step: WizardStep,
  complete = true
): WizardFlowState {
  if (state.completedSteps[step] === complete) return state;
  return {
    ...state,
    completedSteps: { ...state.completedSteps, [step]: complete },
  };
}

// Переход вперёд заблокирован, пока текущий шаг не помечен завершённым —
// это и есть "гейт" навигации, о котором просит бриф.
export function goToNextStep(state: WizardFlowState): WizardFlowState {
  if (!state.completedSteps[state.step]) return state;

  const currentIndex = WIZARD_STEPS.indexOf(state.step);
  const nextStep = WIZARD_STEPS[currentIndex + 1];
  if (!nextStep) return state; // уже на последнем шаге

  return { ...state, step: nextStep };
}

// Назад — без проверки завершённости: к уже открытому шагу всегда можно вернуться.
export function goToPreviousStep(state: WizardFlowState): WizardFlowState {
  const currentIndex = WIZARD_STEPS.indexOf(state.step);
  const previousStep = WIZARD_STEPS[currentIndex - 1];
  if (!previousStep) return state; // уже на первом шаге

  return { ...state, step: previousStep };
}

// ---- Мутация полей черновика ---------------------------------------------

// Частичное обновление — можно передавать как весь провалидированный объект шага
// целиком, так и точечные патчи отдельных полей.
export function updateVehicleDetails(state: WizardFlowState, patch: VehicleDetailsDraft): WizardFlowState {
  return {
    ...state,
    draft: { ...state.draft, vehicle: { ...state.draft.vehicle, ...patch } },
  };
}

export function updateDescription(state: WizardFlowState, description: string): WizardFlowState {
  return { ...state, draft: { ...state.draft, description } };
}

// ---- Фото / жизненный цикл блюра ------------------------------------------

function updatePhoto(
  state: WizardFlowState,
  photoId: string,
  updater: (photo: PhotoDraft) => PhotoDraft
): WizardFlowState {
  return {
    ...state,
    draft: {
      ...state.draft,
      photos: state.draft.photos.map((photo) => (photo.id === photoId ? updater(photo) : photo)),
    },
  };
}

// Не превышаем MAX_LISTING_PHOTOS (FR-02: до 20 фото) — no-op, если лимит уже
// достигнут; UI дополнительно проверяет это же ограничение через photosSchema.
export function addPhoto(state: WizardFlowState, photo: PhotoDraft): WizardFlowState {
  if (state.draft.photos.length >= MAX_LISTING_PHOTOS) return state;
  return { ...state, draft: { ...state.draft, photos: [...state.draft.photos, photo] } };
}

export function removePhoto(state: WizardFlowState, photoId: string): WizardFlowState {
  return {
    ...state,
    draft: { ...state.draft, photos: state.draft.photos.filter((photo) => photo.id !== photoId) },
  };
}

export function markPhotoBlurPending(state: WizardFlowState, photoId: string): WizardFlowState {
  return updatePhoto(state, photoId, (photo) => ({
    id: photo.id,
    status: 'BLUR_PENDING',
    previewUrl: photo.previewUrl,
  }));
}

export function markPhotoBlurDone(
  state: WizardFlowState,
  photoId: string,
  detectedRegions: BlurRegion[]
): WizardFlowState {
  return updatePhoto(state, photoId, (photo) => ({
    id: photo.id,
    status: 'BLUR_DONE',
    previewUrl: photo.previewUrl,
    detectedRegions,
  }));
}

export function markPhotoBlurFailed(state: WizardFlowState, photoId: string, error?: string): WizardFlowState {
  return updatePhoto(state, photoId, (photo) => ({
    id: photo.id,
    status: 'BLUR_FAILED',
    previewUrl: photo.previewUrl,
    error,
  }));
}

// FR-03 acceptance criteria: продавец может вручную скорректировать область
// блюра. Применимо только к фото в статусе BLUR_DONE — для остальных статусов
// ручной области ещё не к чему применять, поэтому no-op.
export function setManualBlurRegions(
  state: WizardFlowState,
  photoId: string,
  regions: BlurRegion[]
): WizardFlowState {
  return updatePhoto(state, photoId, (photo) => {
    if (photo.status !== 'BLUR_DONE') return photo;
    return { ...photo, manualRegions: regions };
  });
}

// ---- Оценка цены (Deal Rating) --------------------------------------------

export function setPriceEstimateLoading(state: WizardFlowState): WizardFlowState {
  return { ...state, draft: { ...state.draft, priceEstimate: { status: 'LOADING' } } };
}

export function setPriceEstimateLoaded(
  state: WizardFlowState,
  result: { label: DealRatingLabel; recommendedMin?: number; recommendedMax?: number }
): WizardFlowState {
  return {
    ...state,
    draft: { ...state.draft, priceEstimate: { status: 'LOADED', ...result } },
  };
}

export function setPriceEstimateFailed(state: WizardFlowState, error?: string): WizardFlowState {
  return { ...state, draft: { ...state.draft, priceEstimate: { status: 'FAILED', error } } };
}

// ---- Отправка на модерацию -------------------------------------------------

// FR-02: после отправки объявление уходит на модерацию (решение обычно ≤ 30 мин).
// Реального бэкенда пока нет — фронт лишь фиксирует терминальное состояние.
// No-op, если не все шаги завершены, либо если уже отправлено (идемпотентность).
export function submitListingDraft(state: WizardFlowState, now: number): WizardFlowState {
  if (state.submission.status === 'PENDING_MODERATION') return state;
  if (!areAllStepsComplete(state)) return state;

  return {
    ...state,
    submission: { status: 'PENDING_MODERATION', submittedAt: now },
  };
}
