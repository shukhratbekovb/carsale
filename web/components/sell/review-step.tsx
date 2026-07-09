'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { Button } from '@/components/ui/button';
import {
  CONDITION_LABELS,
  DRIVE_TYPE_LABELS,
  FUEL_TYPE_LABELS,
  SELL_LABELS,
  TRANSMISSION_LABELS,
} from '@/lib/labels';
import { reviewSchema, type ReviewInput } from '@/lib/validation/sell';
import type { ListingDraft } from '@/types/sell';

interface ReviewStepProps {
  draft: ListingDraft;
  onComplete: (data: ReviewInput) => void;
  onSubmit: () => void;
}

export function ReviewStep({ draft, onComplete, onSubmit }: ReviewStepProps) {
  const { handleSubmit, register } = useForm<ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { description: draft.description ?? '' },
  });

  function handleDescriptionSubmit(data: ReviewInput) {
    onComplete(data);
    onSubmit();
  }

  const { vehicle, photos, priceEstimate } = draft;

  return (
    <form onSubmit={handleSubmit(handleDescriptionSubmit)} className="flex flex-col gap-6" noValidate>
      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          {SELL_LABELS.descriptionLabel}
        </label>
        <textarea
          id="description"
          {...register('description')}
          placeholder={SELL_LABELS.descriptionPlaceholder}
          rows={5}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-4">
        <h3 className="text-sm font-semibold">{SELL_LABELS.reviewVehicleTitle}</h3>
        <p className="text-sm text-muted-foreground">
          {vehicle.make} {vehicle.model}, {vehicle.year} · {vehicle.mileageKm?.toLocaleString('ru-RU')} км ·{' '}
          {vehicle.condition && CONDITION_LABELS[vehicle.condition]} ·{' '}
          {vehicle.transmission && TRANSMISSION_LABELS[vehicle.transmission]} ·{' '}
          {vehicle.driveType && DRIVE_TYPE_LABELS[vehicle.driveType]}
          {vehicle.fuelType ? ` · ${FUEL_TYPE_LABELS[vehicle.fuelType]}` : ''} · {vehicle.city}
        </p>
        <p className="text-sm font-medium">{vehicle.priceUzs?.toLocaleString('ru-RU')} UZS</p>
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-4">
        <h3 className="text-sm font-semibold">{SELL_LABELS.reviewPhotosTitle(photos.length)}</h3>
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photo.id} src={photo.previewUrl} alt="" className="h-16 w-24 rounded object-cover" />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-4">
        <h3 className="text-sm font-semibold">{SELL_LABELS.reviewPriceTitle}</h3>
        {priceEstimate.status === 'LOADED' ? (
          <DealRatingBadge label={priceEstimate.label} />
        ) : (
          <p className="text-sm text-muted-foreground">{SELL_LABELS.priceEstimateFailed}</p>
        )}
      </div>

      <Button type="submit" className="self-end">
        {SELL_LABELS.submit}
      </Button>
    </form>
  );
}
