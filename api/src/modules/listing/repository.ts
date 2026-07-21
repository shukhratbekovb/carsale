import type { ListingStatus, Prisma } from '@prisma/client';
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
