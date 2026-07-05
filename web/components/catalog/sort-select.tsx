'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'date', label: 'Сначала новые' },
  { value: 'price', label: 'Сначала дешёвые' },
  { value: 'dealRating', label: 'Сначала выгодные' },
];

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = searchParams.get('sort') ?? 'date';

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'date') {
      params.delete('sort');
    } else {
      params.set('sort', value);
    }
    router.push(`/catalog?${params.toString()}`);
  }

  return (
    <select
      value={sort}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Сортировка"
      className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
