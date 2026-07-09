'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type Resolver } from 'react-hook-form';
import { FormField } from '@/components/forms/form-field';
import { SelectField } from '@/components/forms/select-field';
import { Button } from '@/components/ui/button';
import { UZ_CITIES } from '@/lib/data/uz-cities';
import {
  CONDITION_LABELS,
  DRIVE_TYPE_LABELS,
  FUEL_TYPE_LABELS,
  SELL_LABELS,
  TRANSMISSION_LABELS,
} from '@/lib/labels';
import { vehicleDetailsSchema, type VehicleDetailsInput } from '@/lib/validation/sell';
import type { VehicleDetailsDraft } from '@/types/sell';

const CONDITION_OPTIONS = Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label }));
const TRANSMISSION_OPTIONS = Object.entries(TRANSMISSION_LABELS).map(([value, label]) => ({ value, label }));
const DRIVE_TYPE_OPTIONS = Object.entries(DRIVE_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const FUEL_TYPE_OPTIONS = Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const CITY_OPTIONS = UZ_CITIES.map((city) => ({ value: city.name, label: city.name }));

interface VehicleDetailsStepProps {
  draft: VehicleDetailsDraft;
  onComplete: (data: VehicleDetailsInput) => void;
}

export function VehicleDetailsStep({ draft, onComplete }: VehicleDetailsStepProps) {
  const { control, handleSubmit } = useForm<VehicleDetailsInput>({
    // z.coerce.number() fields (year/mileageKm/engineVolume/priceUzs) give the schema
    // a pre-parse input type of `unknown`, which makes zodResolver's inferred generic
    // diverge from the (already coerced) VehicleDetailsInput used for defaultValues/
    // Control below — cast to keep the form typed by the post-parse shape everywhere.
    resolver: zodResolver(vehicleDetailsSchema) as Resolver<VehicleDetailsInput>,
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
        <FormField name="make" control={control} label={SELL_LABELS.makeLabel} />
        <FormField name="model" control={control} label={SELL_LABELS.modelLabel} />
        <FormField name="year" control={control} label={SELL_LABELS.yearLabel} type="number" inputMode="numeric" />
        <FormField
          name="mileageKm"
          control={control}
          label={SELL_LABELS.mileageLabel}
          type="number"
          inputMode="numeric"
        />
        <SelectField
          name="condition"
          control={control}
          label={SELL_LABELS.conditionLabel}
          options={CONDITION_OPTIONS}
          placeholder={SELL_LABELS.selectPlaceholder}
        />
        <FormField name="color" control={control} label={SELL_LABELS.colorLabel} />
        <SelectField
          name="transmission"
          control={control}
          label={SELL_LABELS.transmissionLabel}
          options={TRANSMISSION_OPTIONS}
          placeholder={SELL_LABELS.selectPlaceholder}
        />
        <SelectField
          name="driveType"
          control={control}
          label={SELL_LABELS.driveTypeLabel}
          options={DRIVE_TYPE_OPTIONS}
          placeholder={SELL_LABELS.selectPlaceholder}
        />
        <FormField
          name="engineVolume"
          control={control}
          label={SELL_LABELS.engineVolumeLabel}
          type="number"
          step="0.1"
          inputMode="decimal"
        />
        <SelectField
          name="fuelType"
          control={control}
          label={SELL_LABELS.fuelTypeLabel}
          options={FUEL_TYPE_OPTIONS}
          placeholder={SELL_LABELS.selectPlaceholder}
        />
        <SelectField
          name="city"
          control={control}
          label={SELL_LABELS.cityLabel}
          options={CITY_OPTIONS}
          placeholder={SELL_LABELS.selectPlaceholder}
        />
        <FormField
          name="priceUzs"
          control={control}
          label={SELL_LABELS.priceLabel}
          type="number"
          inputMode="numeric"
        />
      </div>

      <Button type="submit" className="self-end">
        {SELL_LABELS.next}
      </Button>
    </form>
  );
}
