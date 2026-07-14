'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { Button } from '@/components/ui/button';
import { getCityDisplayName } from '@/lib/data/uz-cities';
import { createReviewSchema, type ReviewInput } from '@/lib/validation/sell';
import type { ListingDraft } from '@/types/sell';

interface ReviewStepProps {
  draft: ListingDraft;
  onComplete: (data: ReviewInput) => void;
  onSubmit: () => void;
}

export function ReviewStep({ draft, onComplete, onSubmit }: ReviewStepProps) {
  const t = useTranslations('sell');
  const tListing = useTranslations('listing');
  const tValidation = useTranslations('validation');
  const locale = useLocale();

  const reviewSchema = useMemo(() => createReviewSchema(tValidation), [tValidation]);

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
          {t('descriptionLabel')}
        </label>
        <textarea
          id="description"
          {...register('description')}
          placeholder={t('descriptionPlaceholder')}
          rows={5}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-4">
        <h3 className="text-sm font-semibold">{t('reviewVehicleTitle')}</h3>
        <p className="text-sm text-muted-foreground">
          {vehicle.make} {vehicle.model}, {vehicle.year} ·{' '}
          {vehicle.mileageKm != null && t('reviewMileage', { value: vehicle.mileageKm })} ·{' '}
          {vehicle.condition && tListing(`condition.${vehicle.condition}`)} ·{' '}
          {vehicle.transmission && tListing(`transmission.${vehicle.transmission}`)} ·{' '}
          {vehicle.driveType && tListing(`driveType.${vehicle.driveType}`)}
          {vehicle.fuelType ? ` · ${tListing(`fuelType.${vehicle.fuelType}`)}` : ''} ·{' '}
          {vehicle.city && getCityDisplayName(vehicle.city, locale)}
        </p>
        <p className="text-sm font-medium">
          {vehicle.priceUzs != null && t('reviewPrice', { value: vehicle.priceUzs })}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-4">
        <h3 className="text-sm font-semibold">{t('reviewPhotosTitle', { count: photos.length })}</h3>
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photo.id} src={photo.previewUrl} alt="" className="h-16 w-24 rounded object-cover" />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-4">
        <h3 className="text-sm font-semibold">{t('reviewPriceTitle')}</h3>
        {priceEstimate.status === 'LOADED' ? (
          <DealRatingBadge label={priceEstimate.label} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('priceEstimateFailed')}</p>
        )}
      </div>

      <Button type="submit" className="self-end">
        {t('submit')}
      </Button>
    </form>
  );
}
