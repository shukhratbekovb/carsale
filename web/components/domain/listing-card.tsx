import { useLocale } from 'next-intl';
import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { FavoriteButton } from '@/components/domain/favorite-button';
import { ListingPhotoPlaceholder } from '@/components/domain/listing-photo-placeholder';
import { MileageFlag } from '@/components/domain/mileage-flag';
import { VerifiedBadge } from '@/components/domain/verified-badge';
import { Link } from '@/i18n/navigation';
import { getCityDisplayName } from '@/lib/data/uz-cities';
import { formatMileage, formatUzs } from '@/lib/format';
import type { Listing } from '@/types/listing';

// ML-флаги (Deal Rating, пробег) рендерятся вместе с карточкой, не lazy —
// жёсткое acceptance criteria FR-07/NFR-2 (frontend-plan.md §8).
//
// Бейджи с MileageFlag/FavoriteButton (интерактивные элементы) намеренно
// вынесены за пределы <Link>, чтобы не вкладывать их внутрь <a> (невалидный HTML).
export function ListingCard({ listing }: { listing: Listing }) {
  const locale = useLocale();

  return (
    <article className="relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
      <FavoriteButton
        listingId={listing.id}
        listingTitle={`${listing.make} ${listing.model}, ${listing.year}`}
        className="absolute right-3 top-3 z-10"
      />
      <Link href={`/catalog/${listing.id}`} className="block">
        <ListingPhotoPlaceholder className="aspect-[4/3] w-full" />
        <div className="space-y-2 p-4 pb-0">
          <div className="flex items-start justify-between gap-2">
            {/* h2, не h3: карточка используется сразу после <h1> без промежуточного
                <h2> секции на /catalog и /favorites — h3 давал пропуск уровня
                (Lighthouse a11y: heading-order). На /, где перед гридом уже есть
                свой <h2> секции, повтор уровня h2→h2 валиден (не "пропуск"). */}
            <h2 className="font-semibold leading-tight">
              {listing.make} {listing.model}, {listing.year}
            </h2>
            {listing.sellerVerified && <VerifiedBadge />}
          </div>
          <p className="text-lg font-bold">{formatUzs(listing.priceUzs, locale)}</p>
          <p className="text-sm text-muted-foreground">
            {formatMileage(listing.mileageKm, locale)} · {getCityDisplayName(listing.city, locale)}
          </p>
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-2 p-4 pt-2">
        <DealRatingBadge label={listing.dealRating.label} />
        {listing.mileageFlag && <MileageFlag reason={listing.mileageFlagReason} />}
      </div>
    </article>
  );
}
