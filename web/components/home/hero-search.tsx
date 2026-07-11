'use client';

import { useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

// Значения фильтров (марка/модель/год/КПП/пробег/цена) подключаются вместе
// со страницей /catalog (FE-4, FR-06) — здесь только переход к каталогу.
const FILTER_CHIP_KEYS = ['make', 'model', 'year', 'transmission', 'mileage', 'price'] as const;

export function HeroSearch() {
  const t = useTranslations('home');
  const router = useRouter();
  const [query, setQuery] = useState('');

  function goToCatalog() {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    const qs = params.toString();
    router.push(qs ? `/catalog?${qs}` : '/catalog');
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToCatalog();
        }}
        className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 focus-within:ring-2 focus-within:ring-ring"
      >
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          aria-label={t('searchSubmit')}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {FILTER_CHIP_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          >
            {t(`chips.${key}`)}
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ))}
        <button
          type="button"
          onClick={goToCatalog}
          className="ml-auto rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('apply')}
        </button>
      </div>
    </div>
  );
}
