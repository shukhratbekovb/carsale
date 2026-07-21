import type { Prisma } from '@prisma/client';

/**
 * Публичная проекция объявления (BE-4). Форма совпадает с web/types/listing.ts.
 * VIN/госномер НЕ включаются (BR-3); диапазон рекомендованной цены — только
 * продавцу (FR-09), покупателю отдаётся лишь метка Deal Rating.
 */

// Единый select для каталога и карточки — только публичные поля
export const publicListingSelect = {
  id: true,
  priceUzs: true,
  description: true,
  city: true,
  dealRatingLabel: true,
  mileageFlag: true,
  mileageFlagReason: true,
  createdAt: true,
  vehicle: {
    select: {
      make: true,
      model: true,
      year: true,
      mileage: true,
      condition: true,
      color: true,
      engineVolume: true,
      fuelType: true,
      transmission: true,
      driveType: true,
    },
  },
  photos: { select: { blurredUrl: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
  seller: { select: { verificationStatus: true } },
} satisfies Prisma.ListingSelect;

export type PublicListingRow = Prisma.ListingGetPayload<{ select: typeof publicListingSelect }>;

export type PublicDriveType = 'FWD' | 'RWD' | 'AWD' | '4WD';

export interface PublicListing {
  id: string;
  make: string;
  model: string;
  year: number;
  mileageKm: number;
  priceUzs: number;
  city: string;
  transmission: string;
  driveType: PublicDriveType;
  condition: string;
  color?: string;
  engineVolume?: number;
  fuelType?: string;
  description?: string;
  photoUrl?: string;
  dealRating: { label: string };
  mileageFlag: boolean;
  mileageFlagReason?: string;
  sellerVerified: boolean;
  createdAt: string;
}

// Prisma отдаёт имя enum-члена FOUR_WD; наружу — публичное '4WD'
const toPublicDriveType = (dt: string): PublicDriveType =>
  dt === 'FOUR_WD' ? '4WD' : (dt as PublicDriveType);

export function toPublicListing(row: PublicListingRow): PublicListing {
  // vehicle 1:1 всегда есть у опубликованного объявления; на всякий случай — гард
  const v = row.vehicle;
  if (!v) throw new Error(`listing ${row.id} has no vehicle`);

  const photoUrl = row.photos[0]?.blurredUrl;

  return {
    id: row.id,
    make: v.make,
    model: v.model,
    year: v.year,
    mileageKm: v.mileage,
    priceUzs: row.priceUzs.toNumber(),
    city: row.city,
    transmission: v.transmission,
    driveType: toPublicDriveType(v.driveType),
    condition: v.condition,
    ...(v.color ? { color: v.color } : {}),
    ...(v.engineVolume != null ? { engineVolume: v.engineVolume } : {}),
    ...(v.fuelType ? { fuelType: v.fuelType } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(photoUrl ? { photoUrl } : {}),
    // null (не вычислено) → UNAVAILABLE: покупателю всегда показываем метку
    dealRating: { label: row.dealRatingLabel ?? 'UNAVAILABLE' },
    mileageFlag: row.mileageFlag,
    ...(row.mileageFlagReason ? { mileageFlagReason: row.mileageFlagReason } : {}),
    sellerVerified: row.seller.verificationStatus === 'IDENTITY_VERIFIED',
    createdAt: row.createdAt.toISOString(),
  };
}
