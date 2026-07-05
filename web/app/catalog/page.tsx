import { Suspense } from 'react';
import { CatalogFilters } from '@/components/catalog/catalog-filters';
import { SortSelect } from '@/components/catalog/sort-select';
import { ViewToggle } from '@/components/catalog/view-toggle';
import { ListingCard } from '@/components/domain/listing-card';
import { ListingRow } from '@/components/domain/listing-row';
import {
  filterListings,
  findSimilarListings,
  parseCatalogSearchParams,
  sortListings,
} from '@/lib/catalog/filter-listings';
import { mockListings } from '@/lib/mock/listings';
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
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

// SSR обязателен (не CSR-only) — гостевой SEO-маршрут, см. frontend-plan.md §5.
export default function CatalogPage({ searchParams }: CatalogPageProps) {
  const { filters, sort } = parseCatalogSearchParams(searchParams);
  const view: View = firstValue(searchParams.view) === 'list' ? 'list' : 'grid';
  const results = sortListings(filterListings(mockListings, filters), sort);
  const similar = results.length === 0 ? findSimilarListings(mockListings, filters) : [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Каталог объявлений</h1>

      <Suspense fallback={<div className="h-40 rounded-lg border" />}>
        <CatalogFilters />
      </Suspense>

      <div className="mb-4 mt-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{results.length} объявлений</p>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <SortSelect />
          </Suspense>
          <Suspense fallback={null}>
            <ViewToggle />
          </Suspense>
        </div>
      </div>

      {results.length > 0 ? (
        <ListingsCollection listings={results} view={view} />
      ) : (
        <div>
          <p className="mb-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            По вашему запросу ничего не найдено. Показываем похожие объявления.
          </p>
          <ListingsCollection listings={similar} view={view} />
        </div>
      )}
    </main>
  );
}
