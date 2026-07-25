import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ListingDetail } from '@/components/catalog/listing-detail';
import { fetchListing } from '@/lib/catalog/api';
import { getCityDisplayName } from '@/lib/data/uz-cities';
import { formatMileage, formatUzs } from '@/lib/format';

interface ListingPageProps {
  params: { id: string; locale: string };
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const listing = await fetchListing(params.id);
  if (!listing) return {};

  const t = await getTranslations({ locale: params.locale, namespace: 'listingPage' });
  return {
    title: `${listing.make} ${listing.model}, ${listing.year} — ${formatUzs(listing.priceUzs, params.locale)}`,
    description: t('metaDescription', {
      make: listing.make,
      model: listing.model,
      year: listing.year,
      mileage: formatMileage(listing.mileageKm, params.locale),
      city: getCityDisplayName(listing.city, params.locale),
    }),
  };
}

// SSR (не CSR-only) — гостевой SEO-маршрут, см. frontend-plan.md §5. Реальные
// данные из Core `GET /listings/:id` (§5); ML-флаги приходят в том же ответе.
export default async function ListingPage({ params }: ListingPageProps) {
  const listing = await fetchListing(params.id);
  if (!listing) notFound();

  return <ListingDetail listing={listing} />;
}
