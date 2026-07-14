'use client';

import { useTranslations } from 'next-intl';
import { ListingCard } from '@/components/domain/listing-card';
import { useFavorites } from '@/hooks/use-favorites';
import { Link } from '@/i18n/navigation';
import { mockListings } from '@/lib/mock/listings';

// CSR (frontend-plan.md §5, /favorites — P1, FR-13): избранное — client-only
// состояние в localStorage (useFavorites), нет SEO-ценности, серверный рендер
// не нужен. Фильтрация по мок-каталогу — тот же временный источник данных,
// что у /catalog, до появления Core API.
export default function FavoritesPage() {
  const t = useTranslations('favorites');
  const { favoriteIds } = useFavorites();
  const favorites = mockListings.filter((listing) => favoriteIds.includes(listing.id));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">{t('pageTitle')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('count', { count: favorites.length })}</p>

      {favorites.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {favorites.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="text-lg font-semibold">{t('emptyTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('emptyMessage')}</p>
          <Link
            href="/catalog"
            className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('browseCatalog')}
          </Link>
        </div>
      )}
    </main>
  );
}
