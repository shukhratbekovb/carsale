import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { CatalogFilters } from '@/components/catalog/catalog-filters';
import { SortSelect } from '@/components/catalog/sort-select';
import { ViewToggle } from '@/components/catalog/view-toggle';
import { ListingCard } from '@/components/domain/listing-card';
import { ListingRow } from '@/components/domain/listing-row';
import { type CatalogResult, fetchCatalog } from '@/lib/catalog/api';
import type { Listing } from '@/types/listing';

interface CatalogPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

type View = 'grid' | 'list';

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function ListingsCollection({ listings, view }: { listings: Listing[]; view: View }) {
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-3">
        {listings.map((listing) => (
          <ListingRow key={listing.id} listing={listing} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map((listing, index) => (
        // Первая карточка грида — LCP-кандидат страницы каталога, её фото
        // грузим с priority; остальные — лениво (дефолт next/image).
        <ListingCard key={listing.id} listing={listing} priority={index === 0} />
      ))}
    </div>
  );
}

// SSR обязателен (не CSR-only) — гостевой SEO-маршрут, см. frontend-plan.md §5.
// Данные из Core `GET /listings` (§5): фильтры/сортировка/пагинация/«похожие» —
// на сервере, клиентский filter-listings в основной выдаче больше не участвует.
export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const t = await getTranslations('catalog');
  const view: View = firstValue(searchParams.view) === 'list' ? 'list' : 'grid';

  let data: CatalogResult | null = null;
  try {
    data = await fetchCatalog(searchParams);
  } catch {
    // Core недоступен/ошибка — показываем нотис, а не пустую «ничего не найдено»
    data = null;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <Suspense fallback={<div className="h-40 rounded-lg border" />}>
        <CatalogFilters />
      </Suspense>

      {data === null ? (
        <p className="mt-6 rounded-md border border-dashed p-4 text-sm text-destructive">
          {t('loadError')}
        </p>
      ) : (
        <>
          {/* flex-wrap: счётчик + сортировка + переключатель вида не помещаются
              в один ряд на 360px (Linux-рендер шрифтов чуть шире локального —
              ловилось вьюпорт-гейтом NFR-24 на CI) */}
          <div className="mb-4 mt-6 flex flex-wrap items-center justify-between gap-y-2">
            <p className="text-sm text-muted-foreground">{t('count', { count: data.total })}</p>
            <div className="flex items-center gap-2">
              <Suspense fallback={null}>
                <SortSelect />
              </Suspense>
              <Suspense fallback={null}>
                <ViewToggle />
              </Suspense>
            </div>
          </div>

          {data.items.length > 0 ? (
            <ListingsCollection listings={data.items} view={view} />
          ) : (
            <div>
              <p className="mb-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                {t('noResults')}
              </p>
              <ListingsCollection listings={data.similar} view={view} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
