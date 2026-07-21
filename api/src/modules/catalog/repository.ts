import type { Prisma } from '@prisma/client';
import { getPrisma } from '../../lib/prisma.js';
import { type PublicListingRow, publicListingSelect } from './mapper.js';
import type { ListQuery } from './validation.js';

/** Доступ к каталогу (BE-4). Показываем только PUBLISHED; VIN/plate не выбираем. */

function range(min?: number, max?: number): Prisma.IntFilter | undefined {
  if (min == null && max == null) return undefined;
  return { ...(min != null ? { gte: min } : {}), ...(max != null ? { lte: max } : {}) };
}

function buildWhere(q: ListQuery): Prisma.ListingWhereInput {
  const vehicle: Prisma.VehicleWhereInput = {};
  if (q.make) vehicle.make = q.make;
  if (q.model) vehicle.model = q.model;
  const year = range(q.yearMin, q.yearMax);
  if (year) vehicle.year = year;
  const mileage = range(q.mileageMin, q.mileageMax);
  if (mileage) vehicle.mileage = mileage;
  if (q.transmission) vehicle.transmission = q.transmission;
  // публичное '4WD' → Prisma-имя FOUR_WD
  if (q.driveType) vehicle.driveType = q.driveType === '4WD' ? 'FOUR_WD' : q.driveType;
  if (q.q) {
    vehicle.OR = [
      { make: { contains: q.q, mode: 'insensitive' } },
      { model: { contains: q.q, mode: 'insensitive' } },
    ];
  }

  const where: Prisma.ListingWhereInput = { status: 'PUBLISHED' };
  if (Object.keys(vehicle).length > 0) where.vehicle = vehicle;
  const price = range(q.priceMin, q.priceMax);
  if (price) where.priceUzs = price;
  if (q.dealRating) where.dealRatingLabel = q.dealRating;
  if (q.city) where.city = q.city;
  if (q.verifiedOnly) where.seller = { verificationStatus: 'IDENTITY_VERIFIED' };
  return where;
}

function buildOrderBy(sort: ListQuery['sort']): Prisma.ListingOrderByWithRelationInput {
  if (sort === 'price') return { priceUzs: 'asc' };
  // enum объявлен в порядке GREAT_DEAL<FAIR_PRICE<OVERPRICED<UNAVAILABLE — ASC даёт
  // «сначала выгодные»; NULL (не вычислено) уходит в конец (Postgres NULLS LAST)
  if (sort === 'dealRating') return { dealRatingLabel: 'asc' };
  return { createdAt: 'desc' };
}

export async function findPublished(
  q: ListQuery,
): Promise<{ items: PublicListingRow[]; total: number }> {
  const prisma = getPrisma();
  const where = buildWhere(q);
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      select: publicListingSelect,
      orderBy: buildOrderBy(q.sort),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.listing.count({ where }),
  ]);
  return { items, total };
}

export async function findByIdPublic(id: string): Promise<PublicListingRow | null> {
  return getPrisma().listing.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: publicListingSelect,
  });
}

/** UC-01 alt-flow: при пустой выдаче — та же марка, иначе последние по дате. */
export async function findSimilar(q: ListQuery, limit = 4): Promise<PublicListingRow[]> {
  const prisma = getPrisma();
  if (q.make) {
    const sameMake = await prisma.listing.findMany({
      where: { status: 'PUBLISHED', vehicle: { make: q.make } },
      select: publicListingSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    if (sameMake.length > 0) return sameMake;
  }
  return prisma.listing.findMany({
    where: { status: 'PUBLISHED' },
    select: publicListingSelect,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
