import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { DealRatingBadge } from '@/components/domain/deal-rating-badge';
import { ListingPhotoPlaceholder } from '@/components/domain/listing-photo-placeholder';
import { MileageFlag } from '@/components/domain/mileage-flag';
import { VerifiedBadge } from '@/components/domain/verified-badge';
import { Link } from '@/i18n/navigation';
import { formatMileage, formatUzs } from '@/lib/format';
import { mockListings } from '@/lib/mock/listings';
import type { Listing } from '@/types/listing';

interface ListingPageProps {
  params: { id: string; locale: string };
}

function getListing(id: string): Listing | undefined {
  return mockListings.find((listing) => listing.id === id);
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const listing = getListing(params.id);
  if (!listing) return {};

  const t = await getTranslations({ locale: params.locale, namespace: 'listingPage' });
  return {
    title: `${listing.make} ${listing.model}, ${listing.year} — ${formatUzs(listing.priceUzs, params.locale)}`,
    description: t('metaDescription', {
      make: listing.make,
      model: listing.model,
      year: listing.year,
      mileage: formatMileage(listing.mileageKm, params.locale),
      city: listing.city,
    }),
  };
}

// SSR (не CSR-only) — гостевой SEO-маршрут, см. frontend-plan.md §5.
// Deal Rating и флаг пробега рендерятся вместе со страницей, не lazy (FR-07/NFR-2).
export default function ListingPage({ params }: ListingPageProps) {
  const t = useTranslations('listingPage');
  const tListing = useTranslations('listing');
  const locale = useLocale();
  const listing = getListing(params.id);
  if (!listing) notFound();

  const specs: Array<[string, string]> = [
    [t('specs.year'), String(listing.year)],
    [t('specs.mileage'), formatMileage(listing.mileageKm, locale)],
    [t('specs.transmission'), tListing(`transmission.${listing.transmission}`)],
    [t('specs.driveType'), tListing(`driveType.${listing.driveType}`)],
    [t('specs.condition'), tListing(`condition.${listing.condition}`)],
    [t('specs.city'), listing.city],
  ];
  if (listing.color) specs.push([t('specs.color'), listing.color]);
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
          <ListingPhotoPlaceholder className="aspect-video w-full rounded-lg" />

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
              {formatMileage(listing.mileageKm, locale)} · {listing.city}
            </p>

            <div>
              <p className="mb-3 text-sm text-muted-foreground">{t('contactHint')}</p>
              {/* Гость не аутентифицирован — UC-06 alt-flow. Реальный чат появится в FE-5/FE-2. */}
              <Link
                href={`/auth/login?return=/catalog/${listing.id}`}
                className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('loginToChat')}
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
