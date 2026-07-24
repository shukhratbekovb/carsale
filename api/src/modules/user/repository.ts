import type { Prisma } from '@prisma/client';
import { getPrisma } from '../../lib/prisma.js';

/** Доступ к данным профиля/GDPR (BE-9). */

export const profileSelect = {
  id: true,
  email: true,
  role: true,
  verificationStatus: true,
  marketingConsent: true,
  createdAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

export type ProfileRow = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

export async function findProfile(userId: string): Promise<ProfileRow | null> {
  return getPrisma().user.findUnique({ where: { id: userId }, select: profileSelect });
}

export async function setMarketingConsent(userId: string, enabled: boolean): Promise<ProfileRow> {
  return getPrisma().user.update({
    where: { id: userId },
    data: { marketingConsent: enabled },
    select: profileSelect,
  });
}

/** Полный серверный слепок данных пользователя (BE-9.2, NFR-20 переносимость). */
export async function gatherExport(userId: string) {
  const prisma = getPrisma();
  const [profile, listings, favorites, savedSearches, payments, notifications, messages] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: profileSelect }),
      prisma.listing.findMany({
        where: { sellerId: userId },
        select: {
          id: true,
          status: true,
          priceUzs: true,
          city: true,
          description: true,
          createdAt: true,
          vehicle: {
            select: { make: true, model: true, year: true, mileage: true, condition: true },
          },
          photos: { select: { blurredUrl: true } },
        },
      }),
      prisma.favorite.findMany({ where: { userId }, select: { listingId: true, createdAt: true } }),
      prisma.savedSearch.findMany({ where: { userId }, select: { filters: true, createdAt: true } }),
      prisma.payment.findMany({
        where: { userId },
        select: {
          id: true,
          paymentType: true,
          amountUzs: true,
          status: true,
          gateway: true,
          createdAt: true,
        },
      }),
      prisma.notification.findMany({
        where: { userId },
        select: { type: true, payload: true, createdAt: true, readAt: true },
      }),
      prisma.message.findMany({
        where: { senderId: userId },
        select: { threadId: true, text: true, sentAt: true },
      }),
    ]);
  return { profile, listings, favorites, savedSearches, payments, notifications, messages };
}

/**
 * Soft delete + анонимизация PII (BE-9.3, ЗРУ-547): помечает deletedAt,
 * очищает email, обезличивает phone_hash (UNIQUE сохраняется, вход по номеру
 * невозможен), снимает маркетинг. Объявления/чаты/платежи остаются (seller_id
 * FK по RESTRICT) — данные площадки не разрушаются, PII обезличен.
 */
export async function anonymizeAndSoftDelete(userId: string, now: Date): Promise<void> {
  await getPrisma().user.update({
    where: { id: userId },
    data: {
      deletedAt: now,
      email: null,
      // детерминированный обезличенный хеш — не совпадёт ни с одним реальным номером
      phoneHash: `deleted:${userId}`,
      marketingConsent: false,
    },
  });
}
