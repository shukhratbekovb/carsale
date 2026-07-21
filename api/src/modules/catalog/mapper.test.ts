import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { type PublicListingRow, toPublicListing } from './mapper.js';

function row(overrides: Partial<PublicListingRow> = {}): PublicListingRow {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    priceUzs: new Prisma.Decimal(125_000_000),
    description: 'Отличное состояние',
    city: 'Tashkent',
    dealRatingLabel: 'GREAT_DEAL',
    mileageFlag: false,
    mileageFlagReason: null,
    createdAt: new Date('2026-07-01T10:00:00Z'),
    vehicle: {
      make: 'Chevrolet',
      model: 'Cobalt',
      year: 2020,
      mileage: 45000,
      condition: 'GOOD',
      color: 'white',
      engineVolume: 1.5,
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      driveType: 'FWD',
    },
    photos: [{ blurredUrl: 'https://cdn/blur/1.jpg' }],
    seller: { verificationStatus: 'PHONE_VERIFIED' },
  };
  return { ...base, ...overrides } as unknown as PublicListingRow;
}

describe('toPublicListing (BE-4)', () => {
  it('маппит основные поля из vehicle/listing в публичную форму', () => {
    const r = toPublicListing(row());
    expect(r).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      make: 'Chevrolet',
      model: 'Cobalt',
      year: 2020,
      mileageKm: 45000,
      priceUzs: 125_000_000,
      city: 'Tashkent',
      transmission: 'AUTOMATIC',
      driveType: 'FWD',
      condition: 'GOOD',
      dealRating: { label: 'GREAT_DEAL' },
      photoUrl: 'https://cdn/blur/1.jpg',
      sellerVerified: false,
      createdAt: '2026-07-01T10:00:00.000Z',
    });
  });

  it('не выдаёт VIN/госномер и диапазон рекомендованной цены (BR-3, FR-09)', () => {
    const r = toPublicListing(row()) as unknown as Record<string, unknown>;
    expect(r['vin']).toBeUndefined();
    expect(r['licensePlate']).toBeUndefined();
    expect(r['recommendedMin']).toBeUndefined();
    expect((r['dealRating'] as Record<string, unknown>)['recommendedMin']).toBeUndefined();
  });

  it('FOUR_WD → публичное 4WD', () => {
    const r = toPublicListing(row({ vehicle: { ...row().vehicle, driveType: 'FOUR_WD' } as never }));
    expect(r.driveType).toBe('4WD');
  });

  it('dealRatingLabel = null → UNAVAILABLE', () => {
    const r = toPublicListing(row({ dealRatingLabel: null }));
    expect(r.dealRating.label).toBe('UNAVAILABLE');
  });

  it('IDENTITY_VERIFIED → sellerVerified true', () => {
    const r = toPublicListing(row({ seller: { verificationStatus: 'IDENTITY_VERIFIED' } as never }));
    expect(r.sellerVerified).toBe(true);
  });

  it('опциональные поля опускаются, если null/пусто', () => {
    const r = toPublicListing(
      row({
        description: null,
        mileageFlagReason: null,
        photos: [],
        vehicle: { ...row().vehicle, color: null, engineVolume: null, fuelType: null } as never,
      }),
    ) as unknown as Record<string, unknown>;
    for (const key of ['description', 'photoUrl', 'color', 'engineVolume', 'fuelType', 'mileageFlagReason']) {
      expect(key in r).toBe(false);
    }
  });
});
