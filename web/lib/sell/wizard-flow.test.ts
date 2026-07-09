import { describe, expect, test } from 'vitest';
import {
  addPhoto,
  areAllStepsComplete,
  createInitialDraftState,
  goToNextStep,
  goToPreviousStep,
  isStepComplete,
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
} from './wizard-flow';
import { MAX_LISTING_PHOTOS } from '@/lib/validation/sell';
import type { PhotoDraft } from '@/types/sell';

const NOW = 1_000_000;

function uploadingPhoto(id: string): PhotoDraft {
  return { id, status: 'UPLOADING', previewUrl: `blob:${id}` };
}

describe('createInitialDraftState', () => {
  test('starts on VEHICLE_DETAILS with nothing completed and an empty draft', () => {
    const state = createInitialDraftState();
    expect(state.step).toBe('VEHICLE_DETAILS');
    expect(state.draft.vehicle).toEqual({});
    expect(state.draft.photos).toEqual([]);
    expect(state.draft.priceEstimate).toEqual({ status: 'IDLE' });
    expect(state.submission).toEqual({ status: 'NOT_SUBMITTED' });
    expect(areAllStepsComplete(state)).toBe(false);
  });
});

describe('step navigation', () => {
  test('goToNextStep is a no-op while the current step is incomplete', () => {
    const state = createInitialDraftState();
    const result = goToNextStep(state);
    expect(result).toEqual(state);
    expect(result.step).toBe('VEHICLE_DETAILS');
  });

  test('goToNextStep advances once the current step is marked complete', () => {
    let state = createInitialDraftState();
    state = markStepComplete(state, 'VEHICLE_DETAILS');
    state = goToNextStep(state);
    expect(state.step).toBe('PHOTOS');
  });

  test('goToNextStep is a no-op on the last step', () => {
    let state = createInitialDraftState();
    for (const step of ['VEHICLE_DETAILS', 'PHOTOS', 'PRICE', 'REVIEW'] as const) {
      state = markStepComplete(state, step);
      state = goToNextStep(state);
    }
    expect(state.step).toBe('REVIEW');
  });

  test('goToPreviousStep moves back without requiring completion, and no-ops on the first step', () => {
    let state = createInitialDraftState();
    expect(goToPreviousStep(state)).toEqual(state);

    state = markStepComplete(state, 'VEHICLE_DETAILS');
    state = goToNextStep(state);
    expect(state.step).toBe('PHOTOS');

    state = goToPreviousStep(state);
    expect(state.step).toBe('VEHICLE_DETAILS');
  });

  test('isStepComplete/markStepComplete can toggle a step back to incomplete', () => {
    let state = createInitialDraftState();
    state = markStepComplete(state, 'VEHICLE_DETAILS');
    expect(isStepComplete(state, 'VEHICLE_DETAILS')).toBe(true);

    state = markStepComplete(state, 'VEHICLE_DETAILS', false);
    expect(isStepComplete(state, 'VEHICLE_DETAILS')).toBe(false);
  });
});

describe('draft field mutation', () => {
  test('updateVehicleDetails merges partial patches', () => {
    let state = createInitialDraftState();
    state = updateVehicleDetails(state, { make: 'Chevrolet' });
    state = updateVehicleDetails(state, { model: 'Cobalt' });
    expect(state.draft.vehicle).toEqual({ make: 'Chevrolet', model: 'Cobalt' });
  });

  test('updateDescription sets the free-text description', () => {
    let state = createInitialDraftState();
    state = updateDescription(state, 'Один хозяин');
    expect(state.draft.description).toBe('Один хозяин');
  });
});

describe('photo lifecycle', () => {
  test('addPhoto appends and removePhoto removes by id', () => {
    let state = createInitialDraftState();
    state = addPhoto(state, uploadingPhoto('p1'));
    state = addPhoto(state, uploadingPhoto('p2'));
    expect(state.draft.photos.map((p) => p.id)).toEqual(['p1', 'p2']);

    state = removePhoto(state, 'p1');
    expect(state.draft.photos.map((p) => p.id)).toEqual(['p2']);
  });

  test('addPhoto refuses to exceed MAX_LISTING_PHOTOS', () => {
    let state = createInitialDraftState();
    for (let i = 0; i < MAX_LISTING_PHOTOS; i += 1) {
      state = addPhoto(state, uploadingPhoto(`p${i}`));
    }
    expect(state.draft.photos).toHaveLength(MAX_LISTING_PHOTOS);

    const result = addPhoto(state, uploadingPhoto('overflow'));
    expect(result.draft.photos).toHaveLength(MAX_LISTING_PHOTOS);
    expect(result).toBe(state);
  });

  test('markPhotoBlurPending/Done/Failed transition a photo through its lifecycle', () => {
    let state = createInitialDraftState();
    state = addPhoto(state, uploadingPhoto('p1'));

    state = markPhotoBlurPending(state, 'p1');
    expect(state.draft.photos[0]).toEqual({ id: 'p1', status: 'BLUR_PENDING', previewUrl: 'blob:p1' });

    const regions = [{ x: 0.3, y: 0.7, width: 0.2, height: 0.1 }];
    state = markPhotoBlurDone(state, 'p1', regions);
    expect(state.draft.photos[0]).toEqual({
      id: 'p1',
      status: 'BLUR_DONE',
      previewUrl: 'blob:p1',
      detectedRegions: regions,
    });

    state = markPhotoBlurFailed(state, 'p1', 'timeout');
    expect(state.draft.photos[0]).toEqual({
      id: 'p1',
      status: 'BLUR_FAILED',
      previewUrl: 'blob:p1',
      error: 'timeout',
    });
  });

  test('setManualBlurRegions only applies to a photo in BLUR_DONE, no-ops otherwise', () => {
    let state = createInitialDraftState();
    state = addPhoto(state, uploadingPhoto('p1'));

    // Ещё UPLOADING -> no-op.
    const untouched = setManualBlurRegions(state, 'p1', [{ x: 0, y: 0, width: 0.1, height: 0.1 }]);
    expect(untouched.draft.photos[0]).toEqual(state.draft.photos[0]);

    state = markPhotoBlurDone(state, 'p1', [{ x: 0.3, y: 0.7, width: 0.2, height: 0.1 }]);
    const manualRegion = [{ x: 0.4, y: 0.75, width: 0.25, height: 0.12 }];
    state = setManualBlurRegions(state, 'p1', manualRegion);

    expect(state.draft.photos[0]).toMatchObject({ status: 'BLUR_DONE', manualRegions: manualRegion });
  });
});

describe('price estimate', () => {
  test('setPriceEstimateLoading/Loaded/Failed set the corresponding state', () => {
    let state = createInitialDraftState();
    state = setPriceEstimateLoading(state);
    expect(state.draft.priceEstimate).toEqual({ status: 'LOADING' });

    state = setPriceEstimateLoaded(state, { label: 'FAIR_PRICE', recommendedMin: 1, recommendedMax: 2 });
    expect(state.draft.priceEstimate).toEqual({
      status: 'LOADED',
      label: 'FAIR_PRICE',
      recommendedMin: 1,
      recommendedMax: 2,
    });

    state = setPriceEstimateFailed(state, 'network error');
    expect(state.draft.priceEstimate).toEqual({ status: 'FAILED', error: 'network error' });
  });
});

describe('submitListingDraft', () => {
  test('is a no-op unless every step is marked complete', () => {
    let state = createInitialDraftState();
    state = markStepComplete(state, 'VEHICLE_DETAILS');
    state = markStepComplete(state, 'PHOTOS');
    // PRICE/REVIEW ещё не завершены.
    const result = submitListingDraft(state, NOW);
    expect(result.submission).toEqual({ status: 'NOT_SUBMITTED' });
  });

  test('moves to PENDING_MODERATION once all steps are complete', () => {
    let state = createInitialDraftState();
    for (const step of ['VEHICLE_DETAILS', 'PHOTOS', 'PRICE', 'REVIEW'] as const) {
      state = markStepComplete(state, step);
    }
    state = submitListingDraft(state, NOW);
    expect(state.submission).toEqual({ status: 'PENDING_MODERATION', submittedAt: NOW });
  });

  test('is idempotent: resubmitting keeps the original submittedAt', () => {
    let state = createInitialDraftState();
    for (const step of ['VEHICLE_DETAILS', 'PHOTOS', 'PRICE', 'REVIEW'] as const) {
      state = markStepComplete(state, step);
    }
    state = submitListingDraft(state, NOW);
    const resubmitted = submitListingDraft(state, NOW + 5000);
    expect(resubmitted).toEqual(state);
  });
});
