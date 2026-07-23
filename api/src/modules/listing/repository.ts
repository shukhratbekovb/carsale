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
