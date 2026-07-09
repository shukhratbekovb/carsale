'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SELL_LABELS } from '@/lib/labels';
import { mockDetectBlurRegions } from '@/lib/mock/photo-blur';
import { MAX_LISTING_PHOTOS, photosSchema } from '@/lib/validation/sell';
import type { BlurRegion, PhotoDraft } from '@/types/sell';

interface PhotoUploadStepProps {
  photos: PhotoDraft[];
  onAddPhoto: (photo: PhotoDraft) => void;
  onRemovePhoto: (photoId: string) => void;
  onBlurPending: (photoId: string) => void;
  onBlurDone: (photoId: string, regions: BlurRegion[]) => void;
  onBlurFailed: (photoId: string, error?: string) => void;
  onSetManualRegions: (photoId: string, regions: BlurRegion[]) => void;
  onComplete: () => void;
}

function runBlurDetection(
  photo: { id: string },
  onBlurDone: (photoId: string, regions: BlurRegion[]) => void,
  onBlurFailed: (photoId: string, error?: string) => void
) {
  mockDetectBlurRegions(photo.id)
    .then((regions) => onBlurDone(photo.id, regions))
    .catch(() => onBlurFailed(photo.id, 'BLUR_DETECTION_FAILED'));
}

export function PhotoUploadStep({
  photos,
  onAddPhoto,
  onRemovePhoto,
  onBlurPending,
  onBlurDone,
  onBlurFailed,
  onSetManualRegions,
  onComplete,
}: PhotoUploadStepProps) {
  const [formError, setFormError] = useState<string | undefined>();
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  // Отзываем object URL превью при удалении фото/размонтировании шага, чтобы не
  // утекать память — держим актуальный список в ref, т.к. cleanup читает его
  // только на unmount, когда замыкание effect'а уже устарело.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const remainingSlots = MAX_LISTING_PHOTOS - photos.length;

    files.slice(0, remainingSlots).forEach((file) => {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      onAddPhoto({ id, status: 'UPLOADING', previewUrl });
      onBlurPending(id);
      runBlurDetection({ id }, onBlurDone, onBlurFailed);
    });

    event.target.value = '';
  }

  function handleRemove(photoId: string) {
    const photo = photos.find((item) => item.id === photoId);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    onRemovePhoto(photoId);
  }

  function handleRetryBlur(photoId: string) {
    onBlurPending(photoId);
    runBlurDetection({ id: photoId }, onBlurDone, onBlurFailed);
  }

  function handleManualRegionChange(photo: Extract<PhotoDraft, { status: 'BLUR_DONE' }>, patch: Partial<BlurRegion>) {
    const current = photo.manualRegions?.[0] ?? photo.detectedRegions[0];
    const updated: BlurRegion = { ...current, ...patch };
    onSetManualRegions(photo.id, [updated]);
  }

  function handleNext() {
    const result = photosSchema.safeParse({ photoIds: photos.map((photo) => photo.id) });
    if (!result.success) {
      setFormError(result.error.issues[0]?.message);
      return;
    }
    setFormError(undefined);
    onComplete();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{SELL_LABELS.photosHint(MAX_LISTING_PHOTOS)}</p>

      <input
        type="file"
        accept="image/*"
        multiple
        disabled={photos.length >= MAX_LISTING_PHOTOS}
        onChange={handleFilesSelected}
        aria-label={SELL_LABELS.addPhotos}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {photos.map((photo) => {
          const regions =
            photo.status === 'BLUR_DONE' ? (photo.manualRegions ?? photo.detectedRegions) : [];

          return (
            <div key={photo.id} className="flex flex-col gap-2">
              <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                {/* Локальный превью загружаемого фото — не оптимизируется через next/image (blob: URL). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />
                {regions.map((region, index) => (
                  <div
                    key={index}
                    className="absolute border-2 border-destructive bg-destructive/40"
                    style={{
                      left: `${region.x * 100}%`,
                      top: `${region.y * 100}%`,
                      width: `${region.width * 100}%`,
                      height: `${region.height * 100}%`,
                    }}
                  />
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                {photo.status === 'UPLOADING' || photo.status === 'BLUR_PENDING'
                  ? SELL_LABELS.photoBlurPending
                  : photo.status === 'BLUR_DONE'
                    ? SELL_LABELS.photoBlurDone
                    : SELL_LABELS.photoBlurFailed}
              </p>

              {photo.status === 'BLUR_FAILED' && (
                <Button type="button" size="sm" variant="outline" onClick={() => handleRetryBlur(photo.id)}>
                  {SELL_LABELS.photoBlurRetry}
                </Button>
              )}

              {photo.status === 'BLUR_DONE' && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAdjustingId(adjustingId === photo.id ? null : photo.id)}
                  >
                    {SELL_LABELS.photoAdjustBlur}
                  </Button>
                  {adjustingId === photo.id && (
                    <div className="grid grid-cols-2 gap-2">
                      <p className="col-span-2 text-xs text-muted-foreground">
                        {SELL_LABELS.photoBlurRegionLabel(0)}
                      </p>
                      <label className="text-xs">
                        X %
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={Math.round((photo.manualRegions?.[0] ?? photo.detectedRegions[0]).x * 100)}
                          onChange={(event) =>
                            handleManualRegionChange(photo, { x: Number(event.target.value) / 100 })
                          }
                          className="w-full rounded-md border px-2 py-1"
                        />
                      </label>
                      <label className="text-xs">
                        Y %
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={Math.round((photo.manualRegions?.[0] ?? photo.detectedRegions[0]).y * 100)}
                          onChange={(event) =>
                            handleManualRegionChange(photo, { y: Number(event.target.value) / 100 })
                          }
                          className="w-full rounded-md border px-2 py-1"
                        />
                      </label>
                      <label className="text-xs">
                        W %
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={Math.round((photo.manualRegions?.[0] ?? photo.detectedRegions[0]).width * 100)}
                          onChange={(event) =>
                            handleManualRegionChange(photo, { width: Number(event.target.value) / 100 })
                          }
                          className="w-full rounded-md border px-2 py-1"
                        />
                      </label>
                      <label className="text-xs">
                        H %
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={Math.round((photo.manualRegions?.[0] ?? photo.detectedRegions[0]).height * 100)}
                          onChange={(event) =>
                            handleManualRegionChange(photo, { height: Number(event.target.value) / 100 })
                          }
                          className="w-full rounded-md border px-2 py-1"
                        />
                      </label>
                    </div>
                  )}
                </>
              )}

              <Button type="button" size="sm" variant="ghost" onClick={() => handleRemove(photo.id)}>
                {SELL_LABELS.photoRemove}
              </Button>
            </div>
          );
        })}
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <Button type="button" onClick={handleNext} className="self-end">
        {SELL_LABELS.next}
      </Button>
    </div>
  );
}
