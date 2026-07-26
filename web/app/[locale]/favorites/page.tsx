'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RequireAuth } from '@/components/auth/require-auth';
import { ListingCard } from '@/components/domain/listing-card';
import { Link } from '@/i18n/navigation';
import { fetchFavorites } from '@/lib/favorites/favorites-api';
import type { Listing } from '@/types/listing';

// Избранное серверное и привязано к аккаунту (FR-13, §5): RequireAuth редиректит
// гостя на логин; авторизованный видит свои избранные объявления из Core
// `GET /favorites` (те же карточки, что каталог). Раньше — device-local mock.
type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; items: Listing[] };

function FavoritesContent() {
  const t = useTranslations('favorites');
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    fetchFavorites()
      .then((items) => {
        if (!cancelled) setState({ kind: 'ready', items });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">{t('pageTitle')}</h1>

      {state.kind === 'loading' && (
        <div aria-hidden className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {state.kind === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-destructive">{t('loadError')}</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {state.kind === 'ready' && (
        <>
          <p className="mb-6 text-sm text-muted-foreground">{t('count', { count: state.items.length })}</p>
          {state.items.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {state.items.map((listing) => (
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
        </>
      )}
    </main>
  );
}

export default function FavoritesPage() {
  return (
    <RequireAuth>
      <FavoritesContent />
    </RequireAuth>
  );
}
