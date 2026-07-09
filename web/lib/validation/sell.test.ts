import { describe, expect, test } from 'vitest';
import { MAX_DESCRIPTION_LENGTH, MAX_LISTING_PHOTOS, photosSchema, reviewSchema, vehicleDetailsSchema } from './sell';

const CURRENT_YEAR = new Date().getFullYear();

const VALID_VEHICLE = {
  make: 'Chevrolet',
  model: 'Cobalt',
  year: 2019,
  mileageKm: 78000,
  condition: 'GOOD',
  transmission: 'AUTOMATIC',
  driveType: 'FWD',
  city: 'Ташкент',
  priceUzs: 95_000_000,
};

describe('vehicleDetailsSchema', () => {
  test('accepts a fully valid vehicle', () => {
    expect(vehicleDetailsSchema.safeParse(VALID_VEHICLE).success).toBe(true);
  });

  test('accepts optional fields when present', () => {
    const result = vehicleDetailsSchema.safeParse({
      ...VALID_VEHICLE,
      color: 'Белый',
      engineVolume: 1.5,
      fuelType: 'PETROL',
    });
    expect(result.success).toBe(true);
  });

  test('rejects a year before 1980', () => {
    expect(vehicleDetailsSchema.safeParse({ ...VALID_VEHICLE, year: 1979 }).success).toBe(false);
  });

  test('rejects a year further than one year in the future', () => {
    expect(
      vehicleDetailsSchema.safeParse({ ...VALID_VEHICLE, year: CURRENT_YEAR + 2 }).success
    ).toBe(false);
  });

  test('rejects a negative mileage', () => {
    expect(vehicleDetailsSchema.safeParse({ ...VALID_VEHICLE, mileageKm: -1 }).success).toBe(false);
  });

  test('rejects a zero or negative price', () => {
    expect(vehicleDetailsSchema.safeParse({ ...VALID_VEHICLE, priceUzs: 0 }).success).toBe(false);
    expect(vehicleDetailsSchema.safeParse({ ...VALID_VEHICLE, priceUzs: -100 }).success).toBe(false);
  });

  test('rejects an empty make/model', () => {
    expect(vehicleDetailsSchema.safeParse({ ...VALID_VEHICLE, make: '' }).success).toBe(false);
    expect(vehicleDetailsSchema.safeParse({ ...VALID_VEHICLE, model: '' }).success).toBe(false);
  });

  test('rejects a city outside the UZ cities reference list', () => {
    expect(vehicleDetailsSchema.safeParse({ ...VALID_VEHICLE, city: 'Paris' }).success).toBe(false);
  });

  test('rejects an unknown condition/transmission/driveType', () => {
    expect(vehicleDetailsSchema.safeParse({ ...VALID_VEHICLE, condition: 'BAD' }).success).toBe(false);
    expect(
      vehicleDetailsSchema.safeParse({ ...VALID_VEHICLE, transmission: 'STEAM' }).success
    ).toBe(false);
    expect(vehicleDetailsSchema.safeParse({ ...VALID_VEHICLE, driveType: 'AWD2' }).success).toBe(false);
  });
});

describe('reviewSchema', () => {
  test('accepts a missing description (optional)', () => {
    expect(reviewSchema.safeParse({}).success).toBe(true);
  });

  test('accepts a description within the max length', () => {
    expect(reviewSchema.safeParse({ description: 'Хорошая машина' }).success).toBe(true);
  });

  test('rejects a description longer than the max length', () => {
    const tooLong = 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1);
    expect(reviewSchema.safeParse({ description: tooLong }).success).toBe(false);
  });
});

describe('photosSchema', () => {
  test('rejects an empty photo list', () => {
    expect(photosSchema.safeParse({ photoIds: [] }).success).toBe(false);
  });

  test('accepts between 1 and MAX_LISTING_PHOTOS photos', () => {
    expect(photosSchema.safeParse({ photoIds: ['p1'] }).success).toBe(true);
    expect(
      photosSchema.safeParse({ photoIds: Array.from({ length: MAX_LISTING_PHOTOS }, (_, i) => `p${i}`) })
        .success
    ).toBe(true);
  });

  test('rejects more than MAX_LISTING_PHOTOS photos', () => {
    const tooMany = Array.from({ length: MAX_LISTING_PHOTOS + 1 }, (_, i) => `p${i}`);
    expect(photosSchema.safeParse({ photoIds: tooMany }).success).toBe(false);
  });
});
