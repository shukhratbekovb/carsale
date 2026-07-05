import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { ListingPhotoPlaceholder } from '@/components/domain/listing-photo-placeholder';
import { MileageFlag } from '@/components/domain/mileage-flag';
import { VerifiedBadge } from '@/components/domain/verified-badge';
import { formatMileage, formatUzs } from '@/lib/format';
import type { Listing } from '@/types/listing';

// Вид "список" — та же карточка ListingCard, но в горизонтальной раскладке
// для плотного просмотра (переключатель ViewToggle в /catalog).
export function ListingRow({ listing }: { listing: Listing }) {
  return (
    <article className="flex gap-4 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <ListingPhotoPlaceholder className="h-32 w-44 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">
              {listing.make} {listing.model}, {listing.year}
            </h3>
            {listing.sellerVerified && <VerifiedBadge />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatMileage(listing.mileageKm)} · {listing.city}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DealRatingBadge label={listing.dealRating.label} />
            {listing.mileageFlag && <MileageFlag reason={listing.mileageFlagReason} />}
          </div>
        </div>
        <p className="whitespace-nowrap text-lg font-bold sm:text-right">
          {formatUzs(listing.priceUzs)}
        </p>
      </div>
    </article>
  );
}
