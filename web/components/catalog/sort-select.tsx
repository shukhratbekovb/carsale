'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

const SORT_OPTIONS = [
  { value: 'date', labelKey: 'sortDate' },
  { value: 'price', labelKey: 'sortPrice' },
  { value: 'dealRating', labelKey: 'sortDealRating' },
] as const;

export function SortSelect() {
  const t = useTranslations('catalog');
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
      aria-label={t('sortLabel')}
      className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {t(opt.labelKey)}
        </option>
      ))}
    </select>
  );
}
