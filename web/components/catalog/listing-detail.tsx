import { useLocale, useTranslations } from 'next-intl';
import { MessageSellerButton } from '@/components/chat/message-seller-button';
import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { FavoriteButton } from '@/components/domain/favorite-button';
import { ListingPhoto } from '@/components/domain/listing-photo';
import { MileageFlag } from '@/components/domain/mileage-flag';
import { VerifiedBadge } from '@/components/domain/verified-badge';
import { Link } from '@/i18n/navigation';
import { getCityDisplayName } from '@/lib/data/uz-cities';
import { formatMileage, formatUzs } from '@/lib/format';
import { getColorDisplayName } from '@/lib/mock/listing-translations';
import { VEHICLE_REPORT_PRICE_UZS } from '@/lib/mock/payment';
import type { Listing } from '@/types/listing';

/**
 * Презентация карточки объявления (§5). Sync server component — принимает уже
 * загруженное объявление пропом, поэтому async-страница остаётся тонкой (fetch +
 * notFound), а рендер по-прежнему может пользоваться useTranslations/useLocale.
 * Deal Rating и флаг пробега рендерятся вместе со страницей, не lazy (FR-07/NFR-2).
 */
export function ListingDetail({ listing }: { listing: Listing }) {
  const t = useTranslations('listingPage');
  const tListing = useTranslations('listing');
  const tPayment = useTranslations('payment');
  const locale = useLocale();

  const specs: Array<[string, string]> = [
    [t('specs.year'), String(listing.year)],
    [t('specs.mileage'), formatMileage(listing.mileageKm, locale)],
    [t('specs.transmission'), tListing(`transmission.${listing.transmission}`)],
    [t('specs.driveType'), tListing(`driveType.${listing.driveType}`)],
    [t('specs.condition'), tListing(`condition.${listing.condition}`)],
    [t('specs.city'), getCityDisplayName(listing.city, locale)],
  ];
  if (listing.color) specs.push([t('specs.color'), getColorDisplayName(listing.color, locale)]);
  if (listing.engineVolume)
    specs.push([t('specs.engineVolume'), t('engineVolumeValue', { value: listing.engineVolume })]);
  if (listing.fuelType) specs.push([t('specs.fuel'), tListing(`fuelType.${listing.fuelType}`)]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/catalog"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        {t('backToCatalog')}
      </Link>

      <h1 className="mb-4 text-2xl font-bold">
        {listing.make} {listing.model}, {listing.year}
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative">
            <FavoriteButton
              listingId={listing.id}
              listingTitle={`${listing.make} ${listing.model}, ${listing.year}`}
              className="absolute right-3 top-3 z-10"
            />
            {/* Hero-обложка — LCP страницы, поэтому priority. sizes: колонка
                lg:col-span-2 занимает ~2/3 контейнера max-w-7xl. */}
            <ListingPhoto
              photoUrl={listing.photoUrl}
              alt={`${listing.make} ${listing.model}, ${listing.year}`}
              sizes="(max-width: 1024px) 100vw, 66vw"
              priority
              className="aspect-video w-full rounded-lg"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DealRatingBadge label={listing.dealRating.label} />
            {listing.mileageFlag && <MileageFlag reason={listing.mileageFlagReason} />}
          </div>

          {listing.description && (
            <section className="mt-6">
              <h2 className="mb-2 text-lg font-semibold">{t('descriptionTitle')}</h2>
              <p className="text-sm text-muted-foreground">{listing.description}</p>
            </section>
          )}

          <section className="mt-6">
            <h2 className="mb-2 text-lg font-semibold">{t('specsTitle')}</h2>
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {specs.map(([label, value]) => (
                <div key={label} className="flex justify-between border-b py-1.5 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-20 space-y-4 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-2xl font-bold">{formatUzs(listing.priceUzs, locale)}</p>
              {listing.sellerVerified && <VerifiedBadge />}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatMileage(listing.mileageKm, locale)} · {getCityDisplayName(listing.city, locale)}
            </p>

            <div>
              <p className="mb-3 text-sm text-muted-foreground">{t('contactHint')}</p>
              <MessageSellerButton listingId={listing.id} />
            </div>

            <div className="border-t pt-4">
              {/* Платный отчёт (FR-10: «оплата за публикацию и/или расширенный
                  отчёт») — публикация в MVP бесплатна, эта фича демонстрирует
                  именно ветку отчёта. Флоу — FE-6, см. components/payment. */}
              <Link
                href={`/payment/${listing.id}`}
                className="block w-full rounded-md border px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tPayment('reportCta')}
              </Link>
              <p className="mt-1.5 text-center text-xs text-muted-foreground">
                {tPayment('reportCtaHint')} · {formatUzs(VEHICLE_REPORT_PRICE_UZS, locale)}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
