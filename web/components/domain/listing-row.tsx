import { useLocale } from 'next-intl';
import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { FavoriteButton } from '@/components/domain/favorite-button';
import { ListingPhoto } from '@/components/domain/listing-photo';
import { MileageFlag } from '@/components/domain/mileage-flag';
import { VerifiedBadge } from '@/components/domain/verified-badge';
import { Link } from '@/i18n/navigation';
import { getCityDisplayName } from '@/lib/data/uz-cities';
import { formatMileage, formatUzs } from '@/lib/format';
import type { Listing } from '@/types/listing';

// Вид "список" — та же карточка ListingCard, но в горизонтальной раскладке
// для плотного просмотра (переключатель ViewToggle в /catalog).
export function ListingRow({ listing }: { listing: Listing }) {
  const locale = useLocale();

  return (
    <article className="flex gap-4 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <div className="relative shrink-0">
        <FavoriteButton
          listingId={listing.id}
          listingTitle={`${listing.make} ${listing.model}, ${listing.year}`}
          className="absolute right-1 top-1 z-10"
        />
        <Link href={`/catalog/${listing.id}`}>
          {/* Тамбнейл фиксированной ширины (w-44 = 176px) — sizes константный. */}
          <ListingPhoto
            photoUrl={listing.photoUrl}
            alt={`${listing.make} ${listing.model}, ${listing.year}`}
            sizes="176px"
            className="h-32 w-44 rounded-md"
          />
        </Link>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/catalog/${listing.id}`} className="font-semibold hover:underline">
              {listing.make} {listing.model}, {listing.year}
            </Link>
            {listing.sellerVerified && <VerifiedBadge />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatMileage(listing.mileageKm, locale)} · {getCityDisplayName(listing.city, locale)}
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
