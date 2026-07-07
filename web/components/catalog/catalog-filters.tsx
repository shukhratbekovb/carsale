'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { Input } from '@/components/ui/input';
import { DEAL_RATING_LABELS, DRIVE_TYPE_LABELS, TRANSMISSION_LABELS } from '@/lib/labels';
import { mockListings } from '@/lib/mock/listings';

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
        <Field label="Марка" htmlFor="filter-make">
          <select
            id="filter-make"
            value={make}
            onChange={(e) => {
              setMake(e.target.value);
              setModel('');
            }}
            className={selectClassName}
          >
            <option value="">Любая</option>
            {MAKES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Модель" htmlFor="filter-model">
          <select
            id="filter-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className={selectClassName}
          >
            <option value="">Любая</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Год от">
          <Input
            type="number"
            inputMode="numeric"
            aria-label="Год от"
            placeholder="от"
            value={yearMin}
            onChange={(e) => setYearMin(e.target.value)}
          />
        </Field>
        <Field label="Год до">
          <Input
            type="number"
            inputMode="numeric"
            aria-label="Год до"
            placeholder="до"
            value={yearMax}
            onChange={(e) => setYearMax(e.target.value)}
          />
        </Field>

        <Field label="Цена от, сум">
          <Input
            type="number"
            inputMode="numeric"
            aria-label="Цена от"
            placeholder="от"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
          />
        </Field>
        <Field label="Цена до, сум">
          <Input
            type="number"
            inputMode="numeric"
            aria-label="Цена до"
            placeholder="до"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
          />
        </Field>

        <Field label="Пробег от, км">
          <Input
            type="number"
            inputMode="numeric"
            aria-label="Пробег от"
            placeholder="от"
            value={mileageMin}
            onChange={(e) => setMileageMin(e.target.value)}
          />
        </Field>
        <Field label="Пробег до, км">
          <Input
            type="number"
            inputMode="numeric"
            aria-label="Пробег до"
            placeholder="до"
            value={mileageMax}
            onChange={(e) => setMileageMax(e.target.value)}
          />
        </Field>

        <Field label="КПП" htmlFor="filter-transmission">
          <select
            id="filter-transmission"
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
            className={selectClassName}
          >
            <option value="">Любая</option>
            {Object.entries(TRANSMISSION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Привод" htmlFor="filter-drive-type">
          <select
            id="filter-drive-type"
            value={driveType}
            onChange={(e) => setDriveType(e.target.value)}
            className={selectClassName}
          >
            <option value="">Любой</option>
            {Object.entries(DRIVE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Deal Rating" htmlFor="filter-deal-rating">
          <select
            id="filter-deal-rating"
            value={dealRating}
            onChange={(e) => setDealRating(e.target.value)}
            className={selectClassName}
          >
            <option value="">Любой</option>
            {Object.entries(DEAL_RATING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Город" htmlFor="filter-city">
          <select
            id="filter-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={selectClassName}
          >
            <option value="">Любой</option>
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
          Только проверенные продавцы
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Сбросить
          </button>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Применить
          </button>
        </div>
      </div>
    </form>
  );
}
