'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { Link } from '@/i18n/navigation';
import { getCityDisplayName } from '@/lib/data/uz-cities';
import { formatUzs } from '@/lib/format';
import { fetchMyListings } from '@/lib/listings/my-listings-api';
import type { ListingStatus, SellerListing } from '@/types/my-listing';

// Цветовая семантика статуса модерации (не Deal Rating — у того свой бейдж).
// Сплошные bg+foreground (как DealRatingBadge) — контраст токенов гарантирован;
// токены заданы без <alpha-value>, поэтому opacity-модификатор /15 не применяем.
const STATUS_STYLES: Record<ListingStatus, string> = {
  PUBLISHED: 'bg-success text-success-foreground',
  PENDING_MODERATION: 'bg-warning text-warning-foreground',
  REJECTED: 'bg-destructive text-destructive-foreground',
  DRAFT: 'bg-muted text-muted-foreground',
  EXPIRED: 'bg-muted text-muted-foreground',
  ARCHIVED: 'bg-muted text-muted-foreground',
  SOLD: 'bg-primary text-primary-foreground',
};

function StatusBadge({ status }: { status: ListingStatus }) {
  const t = useTranslations('myListings');
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
}

function SellerListingRow({ listing }: { listing: SellerListing }) {
  const locale = useLocale();
  const title = `${listing.make} ${listing.model}, ${listing.year}`;
  const meta = `${formatUzs(listing.priceUzs, locale)} · ${getCityDisplayName(listing.city, locale)}`;

  const body = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border p-4">
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{meta}</p>
      </div>
      <div className="flex items-center gap-2">
        {listing.dealRatingLabel && listing.dealRatingLabel !== 'UNAVAILABLE' && (
          <DealRatingBadge label={listing.dealRatingLabel} />
        )}
        <StatusBadge status={listing.status} />
      </div>
    </div>
  );

  // Опубликованное можно открыть в публичном каталоге; прочие статусы — обзор без ссылки.
  return listing.status === 'PUBLISHED' ? (
    <Link href={`/catalog/${listing.id}`} className="block hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
      {body}
    </Link>
  ) : (
    body
  );
}

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; listings: SellerListing[] };

export function MyListingsList() {
  const t = useTranslations('myListings');
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    fetchMyListings()
      .then((listings) => {
        if (!cancelled) setState({ kind: 'ready', listings });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  if (state.kind === 'loading') {
    return (
      <div aria-hidden className="flex flex-col gap-3">
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-destructive">{t('loadError')}</p>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  if (state.listings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border p-6 text-center">
        <div>
          <p className="font-semibold">{t('emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyMessage')}</p>
        </div>
        <Link
          href="/sell/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('createListing')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {state.listings.map((listing) => (
        <SellerListingRow key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
