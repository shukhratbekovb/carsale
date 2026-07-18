'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FraudFlagBadge } from '@/components/admin/fraud-flag-badge';
import { formatDateDdMmYyyy } from '@/lib/format';
import { ModerationStatusBadge } from '@/components/admin/moderation-status-badge';
import { ListingPhoto } from '@/components/domain/listing-photo';
import { Link } from '@/i18n/navigation';
import { getCityDisplayName } from '@/lib/data/uz-cities';
import { formatUzs } from '@/lib/format';
import { mockFetchModerationQueue } from '@/lib/mock/admin';
import { cn } from '@/lib/utils';
import type { ModerationItem } from '@/types/admin';

// Очередь модерации (UC-15 шаг 2). Сортировку даёт мок: PENDING первыми
// («сначала старые»), решённые — после, визуально приглушены.
// undefined — очередь ещё грузится (паттерн ChatThreadList).
export function ModerationQueue() {
  const t = useTranslations('admin.moderation');
  const locale = useLocale();
  const [items, setItems] = useState<ModerationItem[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    mockFetchModerationQueue().then((result) => {
      if (!cancelled) setItems(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === undefined) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center">
        <p className="text-lg font-semibold">{t('emptyTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('emptyMessage')}</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {items.map((item) => {
        const resolved = item.status !== 'PENDING';
        return (
          <li key={item.id}>
            <Link
              href={`/admin/moderation/${item.id}`}
              className={cn(
                'flex flex-col gap-2 p-4 hover:bg-accent sm:flex-row sm:items-center sm:justify-between',
                resolved && 'opacity-60'
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                {/* Превью-тамбнейл фиксированного размера (w-20 = 80px) — sizes константный. */}
                {item.listing.photoUrl && (
                  <ListingPhoto
                    photoUrl={item.listing.photoUrl}
                    alt={`${item.listing.make} ${item.listing.model}, ${item.listing.year}`}
                    sizes="80px"
                    className="h-14 w-20 shrink-0 rounded-md"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.listing.make} {item.listing.model}, {item.listing.year}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatUzs(item.listing.priceUzs, locale)} ·{' '}
                    {getCityDisplayName(item.listing.city, locale)} ·{' '}
                    {t('flaggedAt', { date: formatDateDdMmYyyy(item.flaggedAt) })}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <FraudFlagBadge flag={item.fraudFlag} />
                <ModerationStatusBadge status={item.status} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
