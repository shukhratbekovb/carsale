import { CORE_API_URL } from '@/lib/api/config';
import type { Listing } from '@/types/listing';

/**
 * Серверные фетчеры каталога (§5). Каталог — публичный SSR-маршрут (SEO, гость),
 * поэтому ходим на Core напрямую сервер-к-серверу (CORE_API_URL), а НЕ через
 * браузерный BFF-прокси. Контракт `GET /listings` / `GET /listings/:id` =
 * api/src/modules/catalog (PublicListing совпадает с types/listing.ts). Фильтрацию/
 * сортировку/пагинацию/«похожие» делает Core — клиентский filter-listings больше
 * не участвует в основной выдаче.
 */

// URL-параметры каталога 1:1 совпадают с query Core (yearMin/priceMax/… /sort/page).
// Прокидываем как есть; неизвестные ключи (view) Core игнорирует (zod strip).
const CATALOG_QUERY_KEYS = [
  'q', 'make', 'model', 'city',
  'yearMin', 'yearMax', 'priceMin', 'priceMax', 'mileageMin', 'mileageMax',
  'transmission', 'driveType', 'dealRating', 'verifiedOnly',
  'sort', 'page', 'pageSize',
] as const;

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export interface CatalogResult {
  items: Listing[];
  total: number;
  page: number;
  pageSize: number;
  /** Смягчённая выдача при нулевом результате (UC-01 alt-flow) — заполняется Core. */
  similar: Listing[];
}

interface CatalogResponseBody {
  items: Listing[];
  total: number;
  page: number;
  page_size: number;
  similar?: Listing[];
}

export async function fetchCatalog(searchParams: RawSearchParams): Promise<CatalogResult> {
  const qs = new URLSearchParams();
  for (const key of CATALOG_QUERY_KEYS) {
    const value = firstValue(searchParams[key]);
    if (value != null && value !== '') qs.set(key, value);
  }
  const res = await fetch(`${CORE_API_URL}/listings?${qs.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`);
  const body = (await res.json()) as CatalogResponseBody;
  return {
    items: body.items,
    total: body.total,
    page: body.page,
    pageSize: body.page_size,
    similar: body.similar ?? [],
  };
}

// Метаданные и рендер карточки вызывают это раздельно (по одному фетчу каждый —
// суммарно 2 на просмотр карточки; приемлемо на Redis-кэше каталога Core, BE-4.2).
export async function fetchListing(id: string): Promise<Listing | null> {
  const res = await fetch(`${CORE_API_URL}/listings/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`listing fetch failed: ${res.status}`);
  return (await res.json()) as Listing;
}
