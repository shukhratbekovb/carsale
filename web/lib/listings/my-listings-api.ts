import { authorizedFetch } from '@/lib/auth/authorized-fetch';
import type { SellerListing } from '@/types/my-listing';

// Объявления текущего продавца (§5). Требует сессии — идёт через authorizedFetch
// (Bearer + авто-refresh на 401). Контракт = Core `GET /my/listings` → { items }.
export async function fetchMyListings(): Promise<SellerListing[]> {
  const res = await authorizedFetch<{ items: SellerListing[] }>('/my/listings');
  return res.items;
}
