import { describe, expect, it } from 'vitest';
import {
  toAdminStatus,
  toAdminUserRecord,
  toModerationItem,
  type AdminUserRow,
  type ModerationRow,
} from './mapper.js';

const decimal = (n: number) => ({ toNumber: () => n });

function modRow(over: Record<string, unknown> = {}): ModerationRow {
  return {
    id: 'lst-1',
    priceUzs: decimal(93000000),
    description: 'desc',
    city: 'Tashkent',
    dealRatingLabel: 'FAIR_PRICE',
    mileageFlag: false,
    mileageFlagReason: null,
    createdAt: new Date('2026-07-12T08:10:00Z'),
    status: 'PENDING_MODERATION',
    fraudFlag: true,
    fraudReason: 'DUPLICATE: same photos',
    vehicle: {
      make: 'Chevrolet',
      model: 'Cobalt',
      year: 2019,
      mileage: 76000,
      condition: 'GOOD',
      color: 'White',
      engineVolume: 1.5,
      fuelType: 'PETROL',
      transmission: 'AUTOMATIC',
      driveType: 'FWD',
    },
    photos: [],
    seller: { id: 'seller-1', verificationStatus: 'PHONE_VERIFIED', createdAt: new Date('2026-07-10T09:00:00Z') },
    ...over,
  } as unknown as ModerationRow;
}

describe('admin mapper (BE-8)', () => {
  it('toModerationItem: снапшот листинга + seller-счётчики + сырой fraud', () => {
    const item = toModerationItem(modRow(), { active: 3, rejected: 1 });
    expect(item.id).toBe('lst-1');
    expect(item.listing.make).toBe('Chevrolet');
    expect(item.listing.priceUzs).toBe(93000000);
    expect(item.fraudFlag).toBe(true);
    expect(item.fraudReason).toBe('DUPLICATE: same photos');
    expect(item.flaggedAt).toBe('2026-07-12T08:10:00.000Z');
    expect(item.seller).toMatchObject({
      id: 'seller-1',
      verified: false,
      registeredAt: '2026-07-10T09:00:00.000Z',
      activeListings: 3,
      previousRejections: 1,
    });
  });

  it('toModerationItem: seller IDENTITY_VERIFIED → verified:true', () => {
    const item = toModerationItem(
      modRow({ seller: { id: 's2', verificationStatus: 'IDENTITY_VERIFIED', createdAt: new Date('2025-01-01') } }),
      { active: 0, rejected: 0 },
    );
    expect(item.seller.verified).toBe(true);
  });

  it('toAdminStatus: SUSPENDED/BANNED как есть, прочее → ACTIVE', () => {
    expect(toAdminStatus('SUSPENDED')).toBe('SUSPENDED');
    expect(toAdminStatus('BANNED')).toBe('BANNED');
    expect(toAdminStatus('PHONE_VERIFIED')).toBe('ACTIVE');
    expect(toAdminStatus('IDENTITY_VERIFIED')).toBe('ACTIVE');
    expect(toAdminStatus('UNVERIFIED')).toBe('ACTIVE');
  });

  it('toAdminUserRecord: маскированный телефон, статус, verified, listingsCount', () => {
    const row = {
      id: 'user-1',
      verificationStatus: 'IDENTITY_VERIFIED',
      createdAt: new Date('2025-09-14T10:00:00Z'),
      _count: { listings: 4 },
    } as unknown as AdminUserRow;
    const rec = toAdminUserRecord(row);
    expect(rec).toEqual({
      id: 'user-1',
      phone: '+998 ** *** ** **',
      registeredAt: '2025-09-14T10:00:00.000Z',
      status: 'ACTIVE',
      verified: true,
      listingsCount: 4,
    });
  });
});
