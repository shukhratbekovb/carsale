import type { DealRatingLabel, DriveType, Listing, Transmission } from '@/types/listing';

export interface CatalogFilters {
  q?: string;
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  mileageMin?: number;
  mileageMax?: number;
  transmission?: Transmission;
  driveType?: DriveType;
  dealRating?: DealRatingLabel;
  city?: string;
  verifiedOnly?: boolean;
}

export type SortOption = 'date' | 'price' | 'dealRating';

export function filterListings(listings: Listing[], filters: CatalogFilters): Listing[] {
  return listings.filter((listing) => {
    if (filters.make && listing.make !== filters.make) return false;
    if (filters.model && listing.model !== filters.model) return false;
    if (filters.yearMin != null && listing.year < filters.yearMin) return false;
    if (filters.yearMax != null && listing.year > filters.yearMax) return false;
    if (filters.priceMin != null && listing.priceUzs < filters.priceMin) return false;
    if (filters.priceMax != null && listing.priceUzs > filters.priceMax) return false;
    if (filters.mileageMin != null && listing.mileageKm < filters.mileageMin) return false;
    if (filters.mileageMax != null && listing.mileageKm > filters.mileageMax) return false;
    if (filters.transmission && listing.transmission !== filters.transmission) return false;
    if (filters.driveType && listing.driveType !== filters.driveType) return false;
    if (filters.dealRating && listing.dealRating.label !== filters.dealRating) return false;
    if (filters.city && listing.city !== filters.city) return false;
    if (filters.verifiedOnly && !listing.sellerVerified) return false;
    if (filters.q) {
      const haystack = `${listing.make} ${listing.model}`.toLowerCase();
      if (!haystack.includes(filters.q.toLowerCase())) return false;
    }
    return true;
  });
}

const DEAL_RATING_RANK: Record<DealRatingLabel, number> = {
  GREAT_DEAL: 0,
  FAIR_PRICE: 1,
  OVERPRICED: 2,
  UNAVAILABLE: 3,
};

export function sortListings(listings: Listing[], sort: SortOption): Listing[] {
  const copy = [...listings];
  switch (sort) {
    case 'price':
      return copy.sort((a, b) => a.priceUzs - b.priceUzs);
    case 'dealRating':
      return copy.sort(
        (a, b) => DEAL_RATING_RANK[a.dealRating.label] - DEAL_RATING_RANK[b.dealRating.label]
      );
    case 'date':
    default:
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

// UC-01 alt-flow: нулевой результат -> «похожие объявления» со смягчёнными фильтрами.
// Сначала пробуем ту же марку, иначе просто показываем последние по дате.
export function findSimilarListings(
  listings: Listing[],
  filters: CatalogFilters,
  limit = 4
): Listing[] {
  if (filters.make) {
    const sameMake = listings.filter((listing) => listing.make === filters.make);
    if (sameMake.length > 0) return sortListings(sameMake, 'date').slice(0, limit);
  }
  return sortListings(listings, 'date').slice(0, limit);
}

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumberParam(value: string | string[] | undefined): number | undefined {
  const raw = firstValue(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseCatalogSearchParams(searchParams: RawSearchParams): {
  filters: CatalogFilters;
  sort: SortOption;
} {
  const filters: CatalogFilters = {
    q: firstValue(searchParams.q),
    make: firstValue(searchParams.make),
    model: firstValue(searchParams.model),
    yearMin: parseNumberParam(searchParams.yearMin),
    yearMax: parseNumberParam(searchParams.yearMax),
    priceMin: parseNumberParam(searchParams.priceMin),
    priceMax: parseNumberParam(searchParams.priceMax),
    mileageMin: parseNumberParam(searchParams.mileageMin),
    mileageMax: parseNumberParam(searchParams.mileageMax),
    transmission: firstValue(searchParams.transmission) as Transmission | undefined,
    driveType: firstValue(searchParams.driveType) as DriveType | undefined,
    dealRating: firstValue(searchParams.dealRating) as DealRatingLabel | undefined,
    city: firstValue(searchParams.city),
    verifiedOnly: firstValue(searchParams.verifiedOnly) === '1',
  };

  const sortRaw = firstValue(searchParams.sort);
  const sort: SortOption = sortRaw === 'price' || sortRaw === 'dealRating' ? sortRaw : 'date';

  return { filters, sort };
}
