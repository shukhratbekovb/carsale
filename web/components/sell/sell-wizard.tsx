'use client';

import { useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { PhotoUploadStep } from '@/components/sell/photo-upload-step';
import { PriceEstimateWidget } from '@/components/sell/price-estimate-widget';
import { ReviewStep } from '@/components/sell/review-step';
import { VehicleDetailsStep } from '@/components/sell/vehicle-details-step';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { pushNotification } from '@/lib/mock/notifications';
import type { PriceEstimateInput, PriceEstimateResult } from '@/lib/mock/price-estimate';
import {
  addPhoto,
  createInitialDraftState,
  goToNextStep,
  goToPreviousStep,
  markPhotoBlurDone,
  markPhotoBlurFailed,
  markPhotoBlurPending,
  markStepComplete,
  removePhoto,
  setManualBlurRegions,
  setPriceEstimateFailed,
  setPriceEstimateLoaded,
  setPriceEstimateLoading,
  submitListingDraft,
  updateDescription,
  updateVehicleDetails,
} from '@/lib/sell/wizard-flow';
import type { ReviewInput, VehicleDetailsInput } from '@/lib/validation/sell';
import { WIZARD_STEPS } from '@/types/sell';
import type { BlurRegion, PhotoDraft, WizardFlowState, WizardStep } from '@/types/sell';

type WizardAction =
  | { type: 'SUBMIT_VEHICLE_DETAILS'; data: VehicleDetailsInput }
  | { type: 'ADD_PHOTO'; photo: PhotoDraft }
  | { type: 'REMOVE_PHOTO'; photoId: string }
  | { type: 'PHOTO_BLUR_PENDING'; photoId: string }
  | { type: 'PHOTO_BLUR_DONE'; photoId: string; regions: BlurRegion[] }
  | { type: 'PHOTO_BLUR_FAILED'; photoId: string; error?: string }
  | { type: 'SET_MANUAL_REGIONS'; photoId: string; regions: BlurRegion[] }
  | { type: 'PHOTOS_COMPLETE' }
  | { type: 'PRICE_LOADING' }
  | { type: 'PRICE_LOADED'; result: PriceEstimateResult }
  | { type: 'PRICE_FAILED'; error?: string }
  | { type: 'PRICE_COMPLETE' }
  | { type: 'SUBMIT_REVIEW'; description?: string }
  | { type: 'SUBMIT_DRAFT'; now: number }
  | { type: 'PREV_STEP' };

// Тонкая обёртка над чистыми функциями lib/sell/wizard-flow.ts — тот же паттерн,
// что и otpReducer в components/auth/otp-form.tsx: reducer только маршрутизирует
// действия, вся бизнес-логика в pure-функциях.
function wizardReducer(state: WizardFlowState, action: WizardAction): WizardFlowState {
  switch (action.type) {
    case 'SUBMIT_VEHICLE_DETAILS': {
      const updated = updateVehicleDetails(state, action.data);
      return goToNextStep(markStepComplete(updated, 'VEHICLE_DETAILS'));
    }
    case 'ADD_PHOTO':
      return addPhoto(state, action.photo);
    case 'REMOVE_PHOTO':
      return removePhoto(state, action.photoId);
    case 'PHOTO_BLUR_PENDING':
      return markPhotoBlurPending(state, action.photoId);
    case 'PHOTO_BLUR_DONE':
      return markPhotoBlurDone(state, action.photoId, action.regions);
    case 'PHOTO_BLUR_FAILED':
      return markPhotoBlurFailed(state, action.photoId, action.error);
    case 'SET_MANUAL_REGIONS':
      return setManualBlurRegions(state, action.photoId, action.regions);
    case 'PHOTOS_COMPLETE':
      return goToNextStep(markStepComplete(state, 'PHOTOS'));
    case 'PRICE_LOADING':
      return setPriceEstimateLoading(state);
    case 'PRICE_LOADED':
      return setPriceEstimateLoaded(state, action.result);
    case 'PRICE_FAILED':
      return setPriceEstimateFailed(state, action.error);
    case 'PRICE_COMPLETE':
      return goToNextStep(markStepComplete(state, 'PRICE'));
    case 'SUBMIT_REVIEW': {
      const updated = action.description ? updateDescription(state, action.description) : state;
      return markStepComplete(updated, 'REVIEW');
    }
    case 'SUBMIT_DRAFT':
      return submitListingDraft(state, action.now);
    case 'PREV_STEP':
      return goToPreviousStep(state);
    default:
      return state;
  }
}

function StepProgress({ current }: { current: WizardStep }) {
  const t = useTranslations('sell');
  const currentIndex = WIZARD_STEPS.indexOf(current);
  return (
    <ol className="mb-6 flex items-center gap-2">
      {WIZARD_STEPS.map((step, index) => (
        <li key={step} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={`h-1.5 w-full rounded-full ${index <= currentIndex ? 'bg-primary' : 'bg-muted'}`}
            aria-hidden
          />
          <span className={`text-xs ${index === currentIndex ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            {t(`steps.${step}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SellWizard() {
  const t = useTranslations('sell');
  const tNotifications = useTranslations('notifications');
  const router = useRouter();
  const [state, dispatch] = useReducer(wizardReducer, undefined, createInitialDraftState);

  if (state.submission.status === 'PENDING_MODERATION') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-lg font-semibold">{t('submittedTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('submittedMessage')}</p>
        <Button type="button" onClick={() => router.push('/catalog')}>
          {t('backToCatalog')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StepProgress current={state.step} />

      {state.step === 'VEHICLE_DETAILS' && (
        <VehicleDetailsStep
          draft={state.draft.vehicle}
          onComplete={(data) => dispatch({ type: 'SUBMIT_VEHICLE_DETAILS', data })}
        />
      )}

      {state.step === 'PHOTOS' && (
        <PhotoUploadStep
          photos={state.draft.photos}
          onAddPhoto={(photo) => dispatch({ type: 'ADD_PHOTO', photo })}
          onRemovePhoto={(photoId) => dispatch({ type: 'REMOVE_PHOTO', photoId })}
          onBlurPending={(photoId) => dispatch({ type: 'PHOTO_BLUR_PENDING', photoId })}
          onBlurDone={(photoId, regions) => dispatch({ type: 'PHOTO_BLUR_DONE', photoId, regions })}
          onBlurFailed={(photoId, error) => dispatch({ type: 'PHOTO_BLUR_FAILED', photoId, error })}
          onSetManualRegions={(photoId, regions) => dispatch({ type: 'SET_MANUAL_REGIONS', photoId, regions })}
          onComplete={() => dispatch({ type: 'PHOTOS_COMPLETE' })}
        />
      )}

      {state.step === 'PRICE' && (
        // Достижимо только после завершения VEHICLE_DETAILS (goToNextStep гейтит
        // навигацию), поэтому обязательные поля PriceEstimateInput уже заполнены.
        <PriceEstimateWidget
          priceEstimate={state.draft.priceEstimate}
          vehicle={state.draft.vehicle as PriceEstimateInput}
          onLoading={() => dispatch({ type: 'PRICE_LOADING' })}
          onLoaded={(result) => dispatch({ type: 'PRICE_LOADED', result })}
          onFailed={(error) => dispatch({ type: 'PRICE_FAILED', error })}
          onComplete={() => dispatch({ type: 'PRICE_COMPLETE' })}
        />
      )}

      {state.step === 'REVIEW' && (
        <ReviewStep
          draft={state.draft}
          onComplete={(data: ReviewInput) => dispatch({ type: 'SUBMIT_REVIEW', description: data.description })}
          onSubmit={() => {
            dispatch({ type: 'SUBMIT_DRAFT', now: Date.now() });
            // Demo-триггер FR-11 (статус объявления) — тот же момент, что
            // UC-08 основной поток называет отправкой уведомления продавцу
            // (docs/analysis/03-use-case-model.md:211), только текст отражает
            // реальный статус этого флоу (на модерации, не «опубликовано»).
            const { make, model, year } = state.draft.vehicle;
            pushNotification(
              'LISTING_STATUS',
              tNotifications('listingStatusTitle'),
              tNotifications('listingStatusBody', { listingTitle: `${make} ${model}, ${year}` }),
              '/my-listings'
            );
          }}
        />
      )}

      {state.step !== 'VEHICLE_DETAILS' && (
        <Button type="button" variant="ghost" onClick={() => dispatch({ type: 'PREV_STEP' })} className="self-start">
          {t('back')}
        </Button>
      )}
    </div>
  );
}
