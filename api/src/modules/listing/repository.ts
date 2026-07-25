import type { DealRatingLabel, ListingStatus, Prisma } from '@prisma/client';
import { getPrisma } from '../../lib/prisma.js';
import type { DraftInput, UpdateInput } from './validation.js';

/** Доступ к объявлениям продавца (BE-3.1). Единственная точка записи LISTING/VEHICLE. */

const toPrismaDriveType = (dt: string): Prisma.VehicleCreateWithoutListingInput['driveType'] =>
  dt === '4WD' ? 'FOUR_WD' : (dt as Prisma.VehicleCreateWithoutListingInput['driveType']);

export const myListingSelect = {
  id: true,
  status: true,
  priceUzs: true,
  city: true,
  dealRatingLabel: true,
  mileageFlag: true,
  fraudFlag: true,
  createdAt: true,
  updatedAt: true,
  vehicle: { select: { make: true, model: true, year: true, mileage: true } },
} satisfies Prisma.ListingSelect;

export type MyListingRow = Prisma.ListingGetPayload<{ select: typeof myListingSelect }>;

export async function createDraft(sellerId: string, input: DraftInput): Promise<{ id: string }> {
  const { make, model, year, mileageKm, condition, color, transmission, driveType, engineVolume, fuelType, city, priceUzs, description } =
    input;
  const created = await getPrisma().listing.create({
    data: {
      sellerId,
      status: 'DRAFT',
      priceUzs,
      city,
      ...(description !== undefined ? { description } : {}),
      vehicle: {
        create: {
          make,
          model,
          year,
          mileage: mileageKm,
          condition,
          transmission,
          driveType: toPrismaDriveType(driveType),
          ...(color !== undefined ? { color } : {}),
          ...(engineVolume !== undefined ? { engineVolume } : {}),
          ...(fuelType !== undefined ? { fuelType } : {}),
        },
      },
    },
    select: { id: true },
  });
  return created;
}

/** Возвращает статус + число фото своего объявления (для проверок владения/публикации). */
export async function findOwnedState(
  id: string,
  sellerId: string,
): Promise<{ status: ListingStatus; photoCount: number } | null> {
  const row = await getPrisma().listing.findFirst({
    where: { id, sellerId },
    select: { status: true, _count: { select: { photos: true } } },
  });
  return row ? { status: row.status, photoCount: row._count.photos } : null;
}

export async function updateDraft(
  id: string,
  input: UpdateInput,
  nextStatus?: ListingStatus,
): Promise<void> {
  const listingData: Prisma.ListingUpdateInput = {};
  if (input.priceUzs !== undefined) listingData.priceUzs = input.priceUzs;
  if (input.city !== undefined) listingData.city = input.city;
  if (input.description !== undefined) listingData.description = input.description;
  if (nextStatus) listingData.status = nextStatus;

  const vehicleData: Prisma.VehicleUpdateWithoutListingInput = {};
  if (input.make !== undefined) vehicleData.make = input.make;
  if (input.model !== undefined) vehicleData.model = input.model;
  if (input.year !== undefined) vehicleData.year = input.year;
  if (input.mileageKm !== undefined) vehicleData.mileage = input.mileageKm;
  if (input.condition !== undefined) vehicleData.condition = input.condition;
  if (input.color !== undefined) vehicleData.color = input.color;
  if (input.transmission !== undefined) vehicleData.transmission = input.transmission;
  if (input.driveType !== undefined) vehicleData.driveType = toPrismaDriveType(input.driveType);
  if (input.engineVolume !== undefined) vehicleData.engineVolume = input.engineVolume;
  if (input.fuelType !== undefined) vehicleData.fuelType = input.fuelType;

  if (Object.keys(vehicleData).length > 0) listingData.vehicle = { update: vehicleData };

  await getPrisma().listing.update({ where: { id }, data: listingData });
}

export async function setStatus(id: string, status: ListingStatus): Promise<void> {
  await getPrisma().listing.update({ where: { id }, data: { status } });
}

export async function listBySeller(sellerId: string): Promise<MyListingRow[]> {
  return getPrisma().listing.findMany({
    where: { sellerId },
    select: myListingSelect,
    orderBy: { createdAt: 'desc' },
  });
}

// --- Deal Rating (BE-3.4) ---

export interface EstimateSource {
  make: string;
  model: string;
  year: number;
  mileage: number;
  condition: string;
  city: string;
  priceUzs: number;
}

/** Признаки + цена своего объявления для запроса оценки в ML. */
export async function findEstimateSource(
  id: string,
  sellerId: string,
): Promise<EstimateSource | null> {
  const row = await getPrisma().listing.findFirst({
    where: { id, sellerId },
    select: {
      city: true,
      priceUzs: true,
      vehicle: { select: { make: true, model: true, year: true, mileage: true, condition: true } },
    },
  });
  if (!row?.vehicle) return null;
  return {
    make: row.vehicle.make,
    model: row.vehicle.model,
    year: row.vehicle.year,
    mileage: row.vehicle.mileage,
    condition: row.vehicle.condition,
    city: row.city,
    priceUzs: row.priceUzs.toNumber(),
  };
}

export interface DealRatingData {
  label: DealRatingLabel;
  score: number | null;
  recommendedMin: number | null;
  recommendedMax: number | null;
  computedAt: Date;
}

/** Сохраняет вердикт на объявлении и в ML_RESULT (1:1, upsert). */
export async function saveDealRating(id: string, d: DealRatingData): Promise<void> {
  await getPrisma().listing.update({
    where: { id },
    data: {
      dealRatingLabel: d.label,
      dealRatingScore: d.score,
      recommendedPriceMin: d.recommendedMin,
      recommendedPriceMax: d.recommendedMax,
      mlResult: {
        upsert: {
          create: {
            dealRatingLabel: d.label,
            dealRatingScore: d.score,
            recommendedMin: d.recommendedMin,
            recommendedMax: d.recommendedMax,
            computedAt: d.computedAt,
          },
          update: {
            dealRatingLabel: d.label,
            dealRatingScore: d.score,
            recommendedMin: d.recommendedMin,
            recommendedMax: d.recommendedMax,
            computedAt: d.computedAt,
          },
        },
      },
    },
  });
}

// --- Фото (BE-3.3) ---

export interface PhotoData {
  id: string;
  listingId: string;
  blurredUrl: string;
  originalKey: string;
  plateDetected: boolean;
  phash: string | null;
  sortOrder: number;
}

export interface PhotoRow {
  id: string;
  blurredUrl: string;
  plateDetected: boolean;
  sortOrder: number;
}

// id общий для ключа в object storage и строки Photo (единый идентификатор фото).
export async function createPhoto(d: PhotoData): Promise<PhotoRow> {
  return getPrisma().photo.create({
    data: {
      id: d.id,
      listingId: d.listingId,
      blurredUrl: d.blurredUrl,
      originalKey: d.originalKey,
      plateDetected: d.plateDetected,
      phash: d.phash,
      sortOrder: d.sortOrder,
    },
    select: { id: true, blurredUrl: true, plateDetected: true, sortOrder: true },
  });
}

export async function listPhotos(listingId: string): Promise<PhotoRow[]> {
  return getPrisma().photo.findMany({
    where: { listingId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, blurredUrl: true, plateDetected: true, sortOrder: true },
  });
}

// --- Fraud check (BE-3.6) ---

export interface FraudSource {
  status: ListingStatus;
  sellerId: string;
  fraudFlag: boolean;
  make: string;
  model: string;
  year: number;
  mileage: number;
  condition: string;
  city: string;
  priceUzs: number;
  phashes: string[];
}

/** Признаки + цена + pHash фото объявления для антифрод-проверки consumer'ом. */
export async function findFraudSource(listingId: string): Promise<FraudSource | null> {
  const row = await getPrisma().listing.findUnique({
    where: { id: listingId },
    select: {
      status: true,
      sellerId: true,
      fraudFlag: true,
      priceUzs: true,
      city: true,
      vehicle: { select: { make: true, model: true, year: true, mileage: true, condition: true } },
      photos: { select: { phash: true } },
    },
  });
  if (!row?.vehicle) return null;
  return {
    status: row.status,
    sellerId: row.sellerId,
    fraudFlag: row.fraudFlag,
    make: row.vehicle.make,
    model: row.vehicle.model,
    year: row.vehicle.year,
    mileage: row.vehicle.mileage,
    condition: row.vehicle.condition,
    city: row.city,
    priceUzs: row.priceUzs.toNumber(),
    phashes: row.photos.map((p) => p.phash).filter((h): h is string => h !== null),
  };
}

/** pHash фото ДРУГИХ объявлений (корпус для сверки дублей). */
export async function findOtherPhotoHashes(
  listingId: string,
): Promise<{ listingId: string; phash: string }[]> {
  const rows = await getPrisma().photo.findMany({
    where: { phash: { not: null }, listingId: { not: listingId } },
    select: { listingId: true, phash: true },
  });
  return rows.map((r) => ({ listingId: r.listingId, phash: r.phash as string }));
}

export interface FraudDecisionData {
  status: ListingStatus;
  publishedAt?: Date;
  expiresAt?: Date;
  fraudFlag: boolean;
  fraudReason: string | null;
  imageHash: string | null;
  computedAt: Date;
}

/** Решение антифрода: статус листинга + fraud-поля + upsert ML_RESULT. */
export async function saveFraudDecision(listingId: string, d: FraudDecisionData): Promise<void> {
  await getPrisma().listing.update({
    where: { id: listingId },
    data: {
      status: d.status,
      fraudFlag: d.fraudFlag,
      fraudReason: d.fraudReason,
      ...(d.publishedAt !== undefined ? { publishedAt: d.publishedAt } : {}),
      ...(d.expiresAt !== undefined ? { expiresAt: d.expiresAt } : {}),
      mlResult: {
        upsert: {
          create: {
            fraudDetected: d.fraudFlag,
            fraudReason: d.fraudReason,
            imageHash: d.imageHash,
            computedAt: d.computedAt,
          },
          update: {
            fraudDetected: d.fraudFlag,
            fraudReason: d.fraudReason,
            imageHash: d.imageHash,
            computedAt: d.computedAt,
          },
        },
      },
    },
  });
}

// --- Жизненный цикл: EXPIRED + retry Deal Rating (BE-3.7) ---

/** PUBLISHED с истёкшим expiresAt → EXPIRED (07 §2.1). Возвращает истёкшие. */
export async function expirePublished(now: Date): Promise<{ id: string; sellerId: string }[]> {
  const prisma = getPrisma();
  const expired = await prisma.listing.findMany({
    where: { status: 'PUBLISHED', expiresAt: { not: null, lt: now } },
    select: { id: true, sellerId: true },
  });
  if (expired.length > 0) {
    await prisma.listing.updateMany({
      where: { id: { in: expired.map((e) => e.id) } },
      data: { status: 'EXPIRED' },
    });
  }
  return expired;
}

/** Объявления с невычисленной оценкой (UNAVAILABLE/null) для retry (BE-3.7). */
export async function findUnavailableForRetry(limit = 50): Promise<string[]> {
  const rows = await getPrisma().listing.findMany({
    where: {
      status: { in: ['PUBLISHED', 'PENDING_MODERATION', 'DRAFT'] },
      OR: [{ dealRatingLabel: null }, { dealRatingLabel: 'UNAVAILABLE' }],
      vehicle: { isNot: null },
    },
    select: { id: true },
    take: limit,
  });
  return rows.map((r) => r.id);
}

/** Источник признаков для системного пересчёта оценки (без проверки владельца). */
export async function findEstimateSourceById(id: string): Promise<EstimateSource | null> {
  const row = await getPrisma().listing.findUnique({
    where: { id },
    select: {
      city: true,
      priceUzs: true,
      vehicle: { select: { make: true, model: true, year: true, mileage: true, condition: true } },
    },
  });
  if (!row?.vehicle) return null;
  return {
    make: row.vehicle.make,
    model: row.vehicle.model,
    year: row.vehicle.year,
    mileage: row.vehicle.mileage,
    condition: row.vehicle.condition,
    city: row.city,
    priceUzs: row.priceUzs.toNumber(),
  };
}
