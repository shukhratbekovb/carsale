import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { ListingPhotoPlaceholder } from '@/components/domain/listing-photo-placeholder';
import { MileageFlag } from '@/components/domain/mileage-flag';
import { VerifiedBadge } from '@/components/domain/verified-badge';
import { formatMileage, formatUzs } from '@/lib/format';
import type { Listing } from '@/types/listing';

// ML-флаги (Deal Rating, пробег) рендерятся вместе с карточкой, не lazy —
// жёсткое acceptance criteria FR-07/NFR-2 (frontend-plan.md §8).
export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <article className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
      <ListingPhotoPlaceholder className="aspect-[4/3] w-full" />
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight">
            {listing.make} {listing.model}, {listing.year}
          </h3>
          {listing.sellerVerified && <VerifiedBadge />}
        </div>
        <p className="text-lg font-bold">{formatUzs(listing.priceUzs)}</p>
        <p className="text-sm text-muted-foreground">
          {formatMileage(listing.mileageKm)} · {listing.city}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <DealRatingBadge label={listing.dealRating.label} />
          {listing.mileageFlag && <MileageFlag reason={listing.mileageFlagReason} />}
        </div>
      </div>
    </article>
  );
}
