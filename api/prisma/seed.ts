import { PrismaClient } from '@prisma/client';

/**
 * Dev-seed каталога: пара продавцов и несколько PUBLISHED-объявлений с авто/фото.
 * Идемпотентен (upsert по фиксированным UUID). Запуск: `npx tsx prisma/seed.ts`.
 * Не для prod — только локальная разработка/ручная проверка каталога (BE-4).
 */
const prisma = new PrismaClient();

const SELLER_VERIFIED = '00000000-0000-0000-0000-0000000000a1';
const SELLER_PLAIN = '00000000-0000-0000-0000-0000000000a2';

interface Seed {
  id: string;
  sellerId: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  city: string;
  transmission: 'AUTOMATIC' | 'MANUAL' | 'CVT' | 'ROBOT';
  driveType: 'FWD' | 'RWD' | 'AWD' | 'FOUR_WD';
  condition: 'NEW' | 'GOOD' | 'FAIR' | 'POOR';
  deal: 'GREAT_DEAL' | 'FAIR_PRICE' | 'OVERPRICED';
  mileageFlag?: boolean;
}

const LISTINGS: Seed[] = [
  { id: '00000000-0000-0000-0000-0000000000b1', sellerId: SELLER_VERIFIED, make: 'Chevrolet', model: 'Cobalt', year: 2021, mileage: 35000, price: 165_000_000, city: 'Tashkent', transmission: 'AUTOMATIC', driveType: 'FWD', condition: 'GOOD', deal: 'GREAT_DEAL' },
  { id: '00000000-0000-0000-0000-0000000000b2', sellerId: SELLER_PLAIN, make: 'Chevrolet', model: 'Nexia', year: 2016, mileage: 120000, price: 110_000_000, city: 'Samarkand', transmission: 'MANUAL', driveType: 'FWD', condition: 'FAIR', deal: 'FAIR_PRICE', mileageFlag: true },
  { id: '00000000-0000-0000-0000-0000000000b3', sellerId: SELLER_VERIFIED, make: 'Kia', model: 'K5', year: 2022, mileage: 20000, price: 480_000_000, city: 'Tashkent', transmission: 'AUTOMATIC', driveType: 'FWD', condition: 'GOOD', deal: 'OVERPRICED' },
  { id: '00000000-0000-0000-0000-0000000000b4', sellerId: SELLER_PLAIN, make: 'Toyota', model: 'Camry', year: 2019, mileage: 85000, price: 320_000_000, city: 'Bukhara', transmission: 'AUTOMATIC', driveType: 'FWD', condition: 'GOOD', deal: 'FAIR_PRICE' },
];

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { id: SELLER_VERIFIED },
    create: { id: SELLER_VERIFIED, phoneHash: 'seed-verified', role: 'SELLER', verificationStatus: 'IDENTITY_VERIFIED' },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: SELLER_PLAIN },
    create: { id: SELLER_PLAIN, phoneHash: 'seed-plain', role: 'SELLER', verificationStatus: 'PHONE_VERIFIED' },
    update: {},
  });

  for (const l of LISTINGS) {
    await prisma.listing.upsert({
      where: { id: l.id },
      update: { status: 'PUBLISHED', priceUzs: l.price, dealRatingLabel: l.deal, mileageFlag: l.mileageFlag ?? false },
      create: {
        id: l.id,
        sellerId: l.sellerId,
        status: 'PUBLISHED',
        priceUzs: l.price,
        city: l.city,
        description: `${l.make} ${l.model} ${l.year}`,
        dealRatingLabel: l.deal,
        mileageFlag: l.mileageFlag ?? false,
        mileageFlagReason: l.mileageFlag ? 'Пробег несовместим с годом' : null,
        publishedAt: new Date(),
        vehicle: {
          create: {
            make: l.make, model: l.model, year: l.year, mileage: l.mileage,
            condition: l.condition, transmission: l.transmission, driveType: l.driveType,
            fuelType: 'PETROL', engineVolume: 1.5,
          },
        },
        photos: { create: { blurredUrl: `https://cdn.local/blur/${l.id}.jpg`, originalKey: `orig/${l.id}.jpg`, sortOrder: 0 } },
      },
    });
  }
  console.log(`seeded ${LISTINGS.length} published listings`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
