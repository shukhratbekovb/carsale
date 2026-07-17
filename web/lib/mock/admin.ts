import type {
  AdminUserRecord,
  ModerationItem,
  PlatformAnalytics,
  RejectReason,
  UserStatus,
} from '@/types/admin';
import { mockListings } from '@/lib/mock/listings';

// Мок Admin API (FE-8, Epic 9, UC-15/16/17) — тот же паттерн, что
// lib/mock/chat.ts: in-memory «база» на уровне модуля, чистые обновления
// массивов при мутациях. Переводимых UI-строк здесь нет — мок отдаёт только
// канонические ключи/данные, все подписи живут в messages/{uz,ru}.json.

const MIN_LATENCY_MS = 300;
const MAX_LATENCY_MS = 700;

function mockLatency(): Promise<void> {
  const delay = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Seed вынесен в фабрики: детерминированные данные (без Math.random) и
// возможность восстановить исходное состояние через __resetAdminMocks().
// Объявления-снапшоты флагнутых листингов НЕ входят в mockListings —
// до решения модератора они скрыты из публичного каталога (UC-15).
function seedModerationItems(): ModerationItem[] {
  return [
    {
      id: 'mod-1',
      listing: {
        id: 'flagged-101',
        make: 'Chevrolet',
        model: 'Cobalt',
        year: 2019,
        mileageKm: 76000,
        priceUzs: 93000000,
        city: 'Ташкент',
        transmission: 'AUTOMATIC',
        driveType: 'FWD',
        condition: 'GOOD',
        color: 'Белый',
        engineVolume: 1.5,
        fuelType: 'PETROL',
        description: 'Срочно продаю, один хозяин, состояние отличное. Звоните в любое время.',
        // Тот же файл, что у объявления '1': визуально демонстрирует «дубль фото» (UC-15) —
        // модератор в демо видит одинаковую обложку у оригинала и флагнутого снапшота.
        photoUrl: '/listings/1.jpg',
        dealRating: { label: 'FAIR_PRICE', recommendedMin: 90000000, recommendedMax: 105000000 },
        mileageFlag: false,
        sellerVerified: false,
        createdAt: '2026-07-12T08:10:00Z',
      },
      // Фото совпадают с объявлением '1' (Chevrolet Cobalt) из публичного каталога.
      fraudFlag: { type: 'DUPLICATE_PHOTOS', duplicateOfListingId: '1' },
      seller: {
        id: 'seller-101',
        name: 'Jasur Toshpulatov',
        registeredAt: '2026-07-10T09:00:00Z',
        verified: false,
        activeListings: 3,
        previousRejections: 1,
      },
      status: 'PENDING',
      flaggedAt: '2026-07-12T09:15:00Z',
    },
    {
      id: 'mod-2',
      listing: {
        id: 'flagged-102',
        make: 'Chevrolet',
        model: 'Gentra',
        year: 2022,
        mileageKm: 21000,
        priceUzs: 68000000,
        city: 'Самарканд',
        transmission: 'AUTOMATIC',
        driveType: 'FWD',
        condition: 'GOOD',
        color: 'Чёрный',
        engineVolume: 1.5,
        fuelType: 'PETROL',
        description: 'Отдаю дёшево, нужны деньги срочно. Предоплата на карту — забронирую за вами.',
        photoUrl: '/listings/5.jpg',
        // Подозрительно низкая цена: рейтинг «слишком хорошо, чтобы быть правдой».
        dealRating: { label: 'GREAT_DEAL', recommendedMin: 118000000, recommendedMax: 130000000 },
        mileageFlag: false,
        sellerVerified: false,
        createdAt: '2026-07-13T06:40:00Z',
      },
      fraudFlag: { type: 'PRICE_ANOMALY', deviationPercent: 45 },
      seller: {
        id: 'seller-102',
        name: 'Otabek Ergashev',
        registeredAt: '2026-07-12T18:30:00Z',
        verified: false,
        activeListings: 1,
        previousRejections: 0,
      },
      status: 'PENDING',
      flaggedAt: '2026-07-13T07:05:00Z',
    },
    {
      id: 'mod-3',
      listing: {
        id: 'flagged-103',
        make: 'Chevrolet',
        model: 'Nexia 3',
        year: 2021,
        mileageKm: 5000,
        priceUzs: 102000000,
        city: 'Самарканд',
        transmission: 'MANUAL',
        driveType: 'FWD',
        condition: 'NEW',
        color: 'Серебристый',
        engineVolume: 1.5,
        fuelType: 'PETROL',
        description: 'Почти новая, пробег минимальный. Торг у капота.',
        // Тот же файл, что у объявления '3' — см. комментарий у mod-1 про дубль фото.
        photoUrl: '/listings/3.jpg',
        dealRating: { label: 'FAIR_PRICE', recommendedMin: 96000000, recommendedMax: 110000000 },
        mileageFlag: false,
        sellerVerified: false,
        createdAt: '2026-07-14T10:20:00Z',
      },
      // Фото совпадают с объявлением '3' (Chevrolet Nexia 3) из публичного каталога.
      fraudFlag: { type: 'DUPLICATE_PHOTOS', duplicateOfListingId: '3' },
      seller: {
        id: 'seller-103',
        name: 'Sherzod Karimov',
        registeredAt: '2026-05-02T12:00:00Z',
        verified: true,
        activeListings: 2,
        previousRejections: 0,
      },
      status: 'PENDING',
      flaggedAt: '2026-07-14T11:00:00Z',
    },
    {
      id: 'mod-4',
      listing: {
        id: 'flagged-104',
        make: 'Kia',
        model: 'Sportage',
        year: 2020,
        mileageKm: 47000,
        priceUzs: 95000000,
        city: 'Ташкент',
        transmission: 'AUTOMATIC',
        driveType: 'AWD',
        condition: 'GOOD',
        color: 'Серый',
        engineVolume: 2.0,
        fuelType: 'PETROL',
        description: 'Уезжаю за границу, продаю за полцены. Пишите только в мессенджер.',
        photoUrl: '/listings/9.jpg',
        // Настолько низкая цена, что модель не даёт уверенной оценки.
        dealRating: { label: 'UNAVAILABLE' },
        mileageFlag: true,
        mileageFlagReason: 'Пробег ниже, чем в предыдущем объявлении с этим госномером',
        sellerVerified: false,
        createdAt: '2026-07-14T15:45:00Z',
      },
      fraudFlag: { type: 'PRICE_ANOMALY', deviationPercent: 58 },
      seller: {
        id: 'seller-104',
        name: 'Dilshod Rahimov',
        registeredAt: '2026-07-14T14:00:00Z',
        verified: false,
        activeListings: 1,
        previousRejections: 2,
      },
      status: 'PENDING',
      flaggedAt: '2026-07-14T16:30:00Z',
    },
    {
      id: 'mod-5',
      listing: {
        id: 'flagged-105',
        make: 'Chevrolet',
        model: 'Onix',
        year: 2023,
        mileageKm: 12000,
        priceUzs: 110000000,
        city: 'Бухара',
        transmission: 'AUTOMATIC',
        driveType: 'FWD',
        condition: 'GOOD',
        color: 'Красный',
        engineVolume: 1.2,
        fuelType: 'PETROL',
        description: 'Машина на гарантии, продаю ниже рынка из-за переезда.',
        photoUrl: '/listings/13.jpg',
        dealRating: { label: 'GREAT_DEAL', recommendedMin: 160000000, recommendedMax: 175000000 },
        mileageFlag: false,
        sellerVerified: true,
        createdAt: '2026-07-15T07:30:00Z',
      },
      fraudFlag: { type: 'PRICE_ANOMALY', deviationPercent: 35 },
      seller: {
        id: 'seller-105',
        name: 'Gulnora Yusupova',
        registeredAt: '2025-11-20T10:00:00Z',
        verified: true,
        activeListings: 1,
        previousRejections: 0,
      },
      status: 'PENDING',
      flaggedAt: '2026-07-15T08:00:00Z',
    },
  ];
}

function seedUsers(): AdminUserRecord[] {
  return [
    {
      id: 'user-1',
      name: 'Baxtiyor Alimov',
      phone: '+998 ** *** ** 45',
      registeredAt: '2025-09-14T10:00:00Z',
      status: 'ACTIVE',
      verified: true,
      listingsCount: 4,
    },
    {
      id: 'user-2',
      name: 'Nodira Saidova',
      phone: '+998 ** *** ** 12',
      registeredAt: '2025-10-02T14:30:00Z',
      status: 'ACTIVE',
      verified: true,
      listingsCount: 2,
    },
    {
      id: 'user-3',
      name: 'Sardor Umarov',
      phone: '+998 ** *** ** 78',
      registeredAt: '2025-12-18T09:15:00Z',
      status: 'ACTIVE',
      verified: false,
      listingsCount: 1,
    },
    {
      id: 'user-4',
      name: 'Dilshod Rahimov',
      phone: '+998 ** *** ** 03',
      registeredAt: '2026-07-14T14:00:00Z',
      status: 'SUSPENDED',
      verified: false,
      listingsCount: 1,
    },
    {
      id: 'user-5',
      name: 'Gulnora Yusupova',
      phone: '+998 ** *** ** 66',
      registeredAt: '2025-11-20T10:00:00Z',
      status: 'ACTIVE',
      verified: true,
      listingsCount: 1,
    },
    {
      id: 'user-6',
      name: 'Jasur Toshpulatov',
      phone: '+998 ** *** ** 91',
      registeredAt: '2026-07-10T09:00:00Z',
      status: 'BANNED',
      verified: false,
      listingsCount: 3,
    },
    {
      id: 'user-7',
      name: 'Malika Karimova',
      phone: '+998 ** *** ** 29',
      registeredAt: '2026-03-05T16:45:00Z',
      status: 'ACTIVE',
      verified: true,
      listingsCount: 0,
    },
    {
      id: 'user-8',
      name: 'Otabek Ergashev',
      phone: '+998 ** *** ** 54',
      registeredAt: '2026-07-12T18:30:00Z',
      status: 'ACTIVE',
      verified: false,
      listingsCount: 1,
    },
  ];
}

let moderationItems: ModerationItem[] = seedModerationItems();
let users: AdminUserRecord[] = seedUsers();

// Очередь модерации (UC-15 шаг 2): нерешённые PENDING первыми, внутри них —
// «сначала старые» по flaggedAt (модератор разбирает хвост очереди);
// решённые (APPROVED/REJECTED) — после, тоже по flaggedAt для стабильности.
export async function mockFetchModerationQueue(): Promise<ModerationItem[]> {
  await mockLatency();
  return [...moderationItems].sort((a, b) => {
    const aPending = a.status === 'PENDING' ? 0 : 1;
    const bPending = b.status === 'PENDING' ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return a.flaggedAt.localeCompare(b.flaggedAt);
  });
}

export function getModerationItem(id: string): ModerationItem | undefined {
  return moderationItems.find((item) => item.id === id);
}

function decideModerationItem(
  id: string,
  update: (item: ModerationItem) => ModerationItem
): ModerationItem | undefined {
  const item = moderationItems.find((candidate) => candidate.id === id);
  if (!item) return undefined;
  // Идемпотентность: повторное решение по уже решённому item — no-op,
  // возвращаем item как есть (защита от двойного клика/гонки двух модераторов).
  if (item.status !== 'PENDING') return item;

  const decided = update(item);
  moderationItems = moderationItems.map((candidate) =>
    candidate.id === id ? decided : candidate
  );
  return decided;
}

// UC-15, решение «одобрить»: флаг считается снятым, объявление возвращается
// в публичный каталог (в моке каталог не трогаем — это забота Core API).
export function approveListing(id: string): ModerationItem | undefined {
  return decideModerationItem(id, (item) => ({
    ...item,
    status: 'APPROVED',
    decision: { decidedAt: new Date().toISOString() },
  }));
}

// UC-15, решение «отклонить»: причина обязательна (продавец получит
// уведомление с ней), комментарий — опциональное пояснение модератора.
export function rejectListing(
  id: string,
  rejectReason: RejectReason,
  comment?: string
): ModerationItem | undefined {
  return decideModerationItem(id, (item) => ({
    ...item,
    status: 'REJECTED',
    decision: { decidedAt: new Date().toISOString(), rejectReason, comment },
  }));
}

export async function mockFetchUsers(): Promise<AdminUserRecord[]> {
  await mockLatency();
  return [...users];
}

// UC-16: suspend/ban/восстановление пользователя одним вызовом —
// целевой статус передаётся явно, без отдельных suspend()/ban().
export function setUserStatus(id: string, status: UserStatus): AdminUserRecord | undefined {
  const user = users.find((candidate) => candidate.id === id);
  if (!user) return undefined;

  const updated: AdminUserRecord = { ...user, status };
  users = users.map((candidate) => (candidate.id === id ? updated : candidate));
  return updated;
}

// Плейсхолдеры до Core API: MAU и приросты за 7 дней невозможно посчитать
// из мок-данных (нет событий активности), поэтому фиксированные константы.
const PLACEHOLDER_ACTIVE_USERS_30D = 1240;
const PLACEHOLDER_NEW_LISTINGS_7D = 37;
const PLACEHOLDER_NEW_USERS_7D = 52;

// UC-17: listings-цифры считаются из mockListings (публичный каталог = active)
// и живого состояния очереди модерации — pendingModeration/rejectedListings
// пересчитываются при каждом вызове, реагируя на approve/reject.
export async function mockFetchAnalytics(): Promise<PlatformAnalytics> {
  await mockLatency();

  const pendingModeration = moderationItems.filter((item) => item.status === 'PENDING').length;
  const rejectedListings = moderationItems.filter((item) => item.status === 'REJECTED').length;

  return {
    // Всё известное платформе: публичный каталог + флагнутые снапшоты на модерации.
    totalListings: mockListings.length + moderationItems.length,
    activeListings: mockListings.length,
    pendingModeration,
    rejectedListings,
    totalUsers: users.length,
    activeUsers30d: PLACEHOLDER_ACTIVE_USERS_30D,
    newListings7d: PLACEHOLDER_NEW_LISTINGS_7D,
    newUsers7d: PLACEHOLDER_NEW_USERS_7D,
  };
}

// Восстановление seed-состояния — только для тестов (Vitest beforeEach),
// чтобы мутации approve/reject/setUserStatus не протекали между кейсами.
export function __resetAdminMocks(): void {
  moderationItems = seedModerationItems();
  users = seedUsers();
}
