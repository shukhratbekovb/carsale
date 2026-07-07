import { describe, expect, test } from 'vitest';
import {
  filterListings,
  findSimilarListings,
  parseCatalogSearchParams,
  sortListings,
} from './filter-listings';
import type { Listing } from '@/types/listing';

const listings: Listing[] = [
  {
    id: '1',
    make: 'Chevrolet',
    model: 'Cobalt',
    year: 2019,
    mileageKm: 78000,
    priceUzs: 95000000,
    city: 'Ташкент',
    transmission: 'AUTOMATIC',
    driveType: 'FWD',
    condition: 'GOOD',
    dealRating: { label: 'GREAT_DEAL' },
    mileageFlag: false,
    sellerVerified: true,
    createdAt: '2026-07-04T09:00:00Z',
  },
  {
    id: '2',
    make: 'Toyota',
    model: 'Camry',
    year: 2018,
    mileageKm: 85000,
    priceUzs: 125000000,
    city: 'Ташкент',
    transmission: 'AUTOMATIC',
    driveType: 'FWD',
    condition: 'GOOD',
    dealRating: { label: 'FAIR_PRICE' },
    mileageFlag: false,
    sellerVerified: false,
    createdAt: '2026-07-05T09:00:00Z',
  },
  {
    id: '3',
    make: 'Chevrolet',
    model: 'Nexia 3',
    year: 2021,
    mileageKm: 42000,
    priceUzs: 108000000,
    city: 'Самарканд',
    transmission: 'MANUAL',
    driveType: 'FWD',
    condition: 'GOOD',
    dealRating: { label: 'OVERPRICED' },
    mileageFlag: false,
    sellerVerified: false,
    createdAt: '2026-07-03T09:00:00Z',
  },
];

describe('filterListings', () => {
  test('filters by make', () => {
    expect(filterListings(listings, { make: 'Chevrolet' })).toHaveLength(2);
  });

  test('filters by verifiedOnly', () => {
    expect(filterListings(listings, { verifiedOnly: true })).toEqual([listings[0]]);
  });

  test('filters by price range', () => {
    expect(filterListings(listings, { priceMin: 100000000, priceMax: 120000000 })).toEqual([
      listings[2],
    ]);
  });

  test('filters by free-text query across make and model', () => {
    expect(filterListings(listings, { q: 'nexia' })).toEqual([listings[2]]);
  });

  test('combines multiple filters with AND semantics', () => {
    expect(filterListings(listings, { make: 'Chevrolet', dealRating: 'OVERPRICED' })).toEqual([
      listings[2],
    ]);
  });

  test('returns everything when no filters are set', () => {
    expect(filterListings(listings, {})).toHaveLength(3);
  });
});

describe('sortListings', () => {
  test('sorts by price ascending', () => {
    expect(sortListings(listings, 'price').map((l) => l.id)).toEqual(['1', '3', '2']);
  });

  test('sorts by Deal Rating, best deals first', () => {
    expect(sortListings(listings, 'dealRating').map((l) => l.id)).toEqual(['1', '2', '3']);
  });

  test('sorts by date, newest first', () => {
    expect(sortListings(listings, 'date').map((l) => l.id)).toEqual(['2', '1', '3']);
  });

  test('does not mutate the input array', () => {
    const original = [...listings];
    sortListings(listings, 'price');
    expect(listings).toEqual(original);
  });
});

describe('findSimilarListings', () => {
  test('falls back to same make when the exact filter combination has no matches', () => {
    const similar = findSimilarListings(listings, { make: 'Chevrolet', model: 'Nonexistent' });
    expect(similar.every((l) => l.make === 'Chevrolet')).toBe(true);
  });

  test('falls back to newest listings when make has no matches either', () => {
    const similar = findSimilarListings(listings, { make: 'Lada' }, 2);
    expect(similar.map((l) => l.id)).toEqual(['2', '1']);
  });
});

describe('parseCatalogSearchParams', () => {
  test('parses string params into typed filters', () => {
    const { filters, sort } = parseCatalogSearchParams({
      make: 'Chevrolet',
      yearMin: '2018',
      priceMax: '100000000',
      verifiedOnly: '1',
      sort: 'price',
    });
    expect(filters).toMatchObject({
      make: 'Chevrolet',
      yearMin: 2018,
      priceMax: 100000000,
      verifiedOnly: true,
    });
    expect(sort).toBe('price');
  });

  test('defaults sort to date for unknown values', () => {
    const { sort } = parseCatalogSearchParams({ sort: 'bogus' });
    expect(sort).toBe('date');
  });

  test('takes the first value when a param repeats', () => {
    const { filters } = parseCatalogSearchParams({ make: ['Chevrolet', 'Toyota'] });
    expect(filters.make).toBe('Chevrolet');
  });
});
