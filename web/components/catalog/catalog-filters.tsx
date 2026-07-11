'use client';

import { useSearchParams } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { useRouter } from '@/i18n/navigation';
import { mockListings } from '@/lib/mock/listings';
import { DEAL_RATING_VALUES, DRIVE_TYPE_VALUES, TRANSMISSION_VALUES } from '@/types/listing';

const MAKES = Array.from(new Set(mockListings.map((l) => l.make))).sort();
const CITIES = Array.from(new Set(mockListings.map((l) => l.city))).sort();

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

export function CatalogFilters() {
  const t = useTranslations('catalog.filters');
  const tListing = useTranslations('listing');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [make, setMake] = useState(searchParams.get('make') ?? '');
  const [model, setModel] = useState(searchParams.get('model') ?? '');
  const [yearMin, setYearMin] = useState(searchParams.get('yearMin') ?? '');
  const [yearMax, setYearMax] = useState(searchParams.get('yearMax') ?? '');
  const [priceMin, setPriceMin] = useState(searchParams.get('priceMin') ?? '');
  const [priceMax, setPriceMax] = useState(searchParams.get('priceMax') ?? '');
  const [mileageMin, setMileageMin] = useState(searchParams.get('mileageMin') ?? '');
  const [mileageMax, setMileageMax] = useState(searchParams.get('mileageMax') ?? '');
  const [transmission, setTransmission] = useState(searchParams.get('transmission') ?? '');
  const [driveType, setDriveType] = useState(searchParams.get('driveType') ?? '');
  const [dealRating, setDealRating] = useState(searchParams.get('dealRating') ?? '');
  const [city, setCity] = useState(searchParams.get('city') ?? '');
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get('verifiedOnly') === '1');

  const models = Array.from(
    new Set(mockListings.filter((l) => !make || l.make === make).map((l) => l.model))
  ).sort();

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    const q = searchParams.get('q');
    const sort = searchParams.get('sort');
    const view = searchParams.get('view');
    if (q) params.set('q', q);
    if (make) params.set('make', make);
    if (model) params.set('model', model);
    if (yearMin) params.set('yearMin', yearMin);
    if (yearMax) params.set('yearMax', yearMax);
    if (priceMin) params.set('priceMin', priceMin);
    if (priceMax) params.set('priceMax', priceMax);
    if (mileageMin) params.set('mileageMin', mileageMin);
    if (mileageMax) params.set('mileageMax', mileageMax);
    if (transmission) params.set('transmission', transmission);
    if (driveType) params.set('driveType', driveType);
    if (dealRating) params.set('dealRating', dealRating);
    if (city) params.set('city', city);
    if (verifiedOnly) params.set('verifiedOnly', '1');
    if (sort) params.set('sort', sort);
    if (view) params.set('view', view);
    router.push(`/catalog?${params.toString()}`);
  }

  function reset() {
    setMake('');
    setModel('');
    setYearMin('');
    setYearMax('');
    setPriceMin('');
    setPriceMax('');
    setMileageMin('');
    setMileageMax('');
    setTransmission('');
    setDriveType('');
    setDealRating('');
    setCity('');
    setVerifiedOnly(false);
    router.push('/catalog');
  }

  return (
    <form onSubmit={apply} className="rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Field label={t('make')} htmlFor="filter-make">
          <select
            id="filter-make"
            value={make}
            onChange={(e) => {
              setMake(e.target.value);
              setModel('');
            }}
            className={selectClassName}
          >
            <option value="">{t('anyFeminine')}</option>
            {MAKES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('model')} htmlFor="filter-model">
          <select
            id="filter-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={selectClassName}
          >
            <option value="">{t('anyFeminine')}</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('yearFrom')}>
          <Input
            type="number"
            inputMode="numeric"
            aria-label={t('yearFrom')}
            placeholder={t('from')}
            value={yearMin}
            onChange={(e) => setYearMin(e.target.value)}
          />
        </Field>
        <Field label={t('yearTo')}>
          <Input
            type="number"
            inputMode="numeric"
            aria-label={t('yearTo')}
            placeholder={t('to')}
            value={yearMax}
            onChange={(e) => setYearMax(e.target.value)}
          />
        </Field>

        <Field label={t('priceFrom')}>
          <Input
            type="number"
            inputMode="numeric"
            aria-label={t('priceFrom')}
            placeholder={t('from')}
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
          />
        </Field>
        <Field label={t('priceTo')}>
          <Input
            type="number"
            inputMode="numeric"
            aria-label={t('priceTo')}
            placeholder={t('to')}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
          />
        </Field>

        <Field label={t('mileageFrom')}>
          <Input
            type="number"
            inputMode="numeric"
            aria-label={t('mileageFrom')}
            placeholder={t('from')}
            value={mileageMin}
            onChange={(e) => setMileageMin(e.target.value)}
          />
        </Field>
        <Field label={t('mileageTo')}>
          <Input
            type="number"
            inputMode="numeric"
            aria-label={t('mileageTo')}
            placeholder={t('to')}
            value={mileageMax}
            onChange={(e) => setMileageMax(e.target.value)}
          />
        </Field>

        <Field label={t('transmission')} htmlFor="filter-transmission">
          <select
            id="filter-transmission"
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
            className={selectClassName}
          >
            <option value="">{t('anyFeminine')}</option>
            {TRANSMISSION_VALUES.map((value) => (
              <option key={value} value={value}>
                {tListing(`transmission.${value}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('driveType')} htmlFor="filter-drive-type">
          <select
            id="filter-drive-type"
            value={driveType}
            onChange={(e) => setDriveType(e.target.value)}
            className={selectClassName}
          >
            <option value="">{t('anyMasculine')}</option>
            {DRIVE_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {tListing(`driveType.${value}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('dealRating')} htmlFor="filter-deal-rating">
          <select
            id="filter-deal-rating"
            value={dealRating}
            onChange={(e) => setDealRating(e.target.value)}
            className={selectClassName}
          >
            <option value="">{t('anyMasculine')}</option>
            {DEAL_RATING_VALUES.map((value) => (
              <option key={value} value={value}>
                {tListing(`dealRating.${value}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('city')} htmlFor="filter-city">
          <select
            id="filter-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={selectClassName}
          >
            <option value="">{t('anyMasculine')}</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          {t('verifiedOnly')}
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t('reset')}
          </button>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('apply')}
          </button>
        </div>
      </div>
    </form>
  );
}
