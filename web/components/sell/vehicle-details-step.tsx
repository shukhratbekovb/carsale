'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { FormField } from '@/components/forms/form-field';
import { SelectField } from '@/components/forms/select-field';
import { Button } from '@/components/ui/button';
import { UZ_CITIES } from '@/lib/data/uz-cities';
import { createVehicleDetailsSchema, type VehicleDetailsInput } from '@/lib/validation/sell';
import {
  CONDITION_VALUES,
  DRIVE_TYPE_VALUES,
  FUEL_TYPE_VALUES,
  TRANSMISSION_VALUES,
} from '@/types/listing';
import type { VehicleDetailsDraft } from '@/types/sell';

const CITY_OPTIONS = UZ_CITIES.map((city) => ({ value: city.name, label: city.name }));

interface VehicleDetailsStepProps {
  draft: VehicleDetailsDraft;
  onComplete: (data: VehicleDetailsInput) => void;
}

export function VehicleDetailsStep({ draft, onComplete }: VehicleDetailsStepProps) {
  const t = useTranslations('sell');
  const tListing = useTranslations('listing');
  const tValidation = useTranslations('validation');

  const schema = useMemo(() => createVehicleDetailsSchema(tValidation), [tValidation]);

  const conditionOptions = CONDITION_VALUES.map((value) => ({
    value,
    label: tListing(`condition.${value}`),
  }));
  const transmissionOptions = TRANSMISSION_VALUES.map((value) => ({
    value,
    label: tListing(`transmission.${value}`),
  }));
  const driveTypeOptions = DRIVE_TYPE_VALUES.map((value) => ({
    value,
    label: tListing(`driveType.${value}`),
  }));
  const fuelTypeOptions = FUEL_TYPE_VALUES.map((value) => ({
    value,
    label: tListing(`fuelType.${value}`),
  }));

  const { control, handleSubmit } = useForm<VehicleDetailsInput>({
    // z.coerce.number() fields (year/mileageKm/engineVolume/priceUzs) give the schema
    // a pre-parse input type of `unknown`, which makes zodResolver's inferred generic
    // diverge from the (already coerced) VehicleDetailsInput used for defaultValues/
    // Control below — cast to keep the form typed by the post-parse shape everywhere.
    resolver: zodResolver(schema) as Resolver<VehicleDetailsInput>,
    defaultValues: {
      make: draft.make ?? '',
      model: draft.model ?? '',
      year: draft.year,
      mileageKm: draft.mileageKm,
      condition: draft.condition,
      // Не подставляем '' по умолчанию: color опционален в схеме (z.string().min(1).optional()),
      // а пустая строка не проходит .optional() (только undefined) — FormField сам
      // отрисует '' в самом <input> через свой value={field.value ?? ''} fallback.
      color: draft.color,
      transmission: draft.transmission,
      driveType: draft.driveType,
      engineVolume: draft.engineVolume,
      fuelType: draft.fuelType,
      city: draft.city,
      priceUzs: draft.priceUzs,
    },
  });

  return (
    <form onSubmit={handleSubmit(onComplete)} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField name="make" control={control} label={t('makeLabel')} />
        <FormField name="model" control={control} label={t('modelLabel')} />
        <FormField name="year" control={control} label={t('yearLabel')} type="number" inputMode="numeric" />
        <FormField
          name="mileageKm"
          control={control}
          label={t('mileageLabel')}
          type="number"
          inputMode="numeric"
        />
        <SelectField
          name="condition"
          control={control}
          label={t('conditionLabel')}
          options={conditionOptions}
          placeholder={t('selectPlaceholder')}
        />
        <FormField name="color" control={control} label={t('colorLabel')} />
        <SelectField
          name="transmission"
          control={control}
          label={t('transmissionLabel')}
          options={transmissionOptions}
          placeholder={t('selectPlaceholder')}
        />
        <SelectField
          name="driveType"
          control={control}
          label={t('driveTypeLabel')}
          options={driveTypeOptions}
          placeholder={t('selectPlaceholder')}
        />
        <FormField
          name="engineVolume"
          control={control}
          label={t('engineVolumeLabel')}
          type="number"
          step="0.1"
          inputMode="decimal"
        />
        <SelectField
          name="fuelType"
          control={control}
          label={t('fuelTypeLabel')}
          options={fuelTypeOptions}
          placeholder={t('selectPlaceholder')}
        />
        <SelectField
          name="city"
          control={control}
          label={t('cityLabel')}
          options={CITY_OPTIONS}
          placeholder={t('selectPlaceholder')}
        />
        <FormField
          name="priceUzs"
          control={control}
          label={t('priceLabel')}
          type="number"
          inputMode="numeric"
        />
      </div>

      <Button type="submit" className="self-end">
        {t('next')}
      </Button>
    </form>
  );
}
