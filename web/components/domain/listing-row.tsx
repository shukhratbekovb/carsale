import { useLocale } from 'next-intl';
import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { ListingPhotoPlaceholder } from '@/components/domain/listing-photo-placeholder';
import { MileageFlag } from '@/components/domain/mileage-flag';
import { VerifiedBadge } from '@/components/domain/verified-badge';
import { Link } from '@/i18n/navigation';
import { formatMileage, formatUzs } from '@/lib/format';
import type { Listing } from '@/types/listing';

// Вид "список" — та же карточка ListingCard, но в горизонтальной раскладке
// для плотного просмотра (переключатель ViewToggle в /catalog).
export function ListingRow({ listing }: { listing: Listing }) {
  const locale = useLocale();

  return (
    <article className="flex gap-4 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <Link href={`/catalog/${listing.id}`} className="shrink-0">
        <ListingPhotoPlaceholder className="h-32 w-44 rounded-md" />
      </Link>
      <div className="flex flex-1 flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/catalog/${listing.id}`} className="font-semibold hover:underline">
              {listing.make} {listing.model}, {listing.year}
            </Link>
            {listing.sellerVerified && <VerifiedBadge />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatMileage(listing.mileageKm, locale)} · {listing.city}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DealRatingBadge label={listing.dealRating.label} />
            {listing.mileageFlag && <MileageFlag reason={listing.mileageFlagReason} />}
          </div>
        </div>
        <p className="whitespace-nowrap text-lg font-bold sm:text-right">
          {formatUzs(listing.priceUzs, locale)}
        </p>
      </div>
    </article>
  );
}
