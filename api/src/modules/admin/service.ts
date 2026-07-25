import type { VerificationStatus } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import { invalidateCatalog } from '../catalog/cache.js';
import { computeExpiry } from '../listing/service.js';
import { assertTransition } from '../listing/status-machine.js';
import { notify } from '../notification/service.js';
import {
  toAdminUserRecord,
  toModerationItem,
  type AdminUserRecord,
  type AdminUserStatus,
  type ModerationItem,
} from './mapper.js';
import {
  analyticsCounts,
  decideListing,
  findModerationItem,
  findModerationQueue,
  findModerationTarget,
  findUsers,
  findUserStatus,
  sellerCounts,
  setUserVerification,
  type AnalyticsCounts,
} from './repository.js';
import type { RejectInput } from './validation.js';

/** Admin-сервис (BE-8, UC-15/16/17). Все вызовы — только для роли ADMIN (гейт в роутере). */

export async function getModerationQueue(): Promise<ModerationItem[]> {
  const rows = await findModerationQueue();
  const counts = await sellerCounts([...new Set(rows.map((r) => r.seller.id))]);
  return rows.map((r) => toModerationItem(r, counts.get(r.seller.id) ?? { active: 0, rejected: 0 }));
}

export async function getModerationItem(id: string): Promise<ModerationItem> {
  const row = await findModerationItem(id);
  if (!row) throw new AppError(404, 'moderation_item_not_found', 'Moderation item not found');
  const counts = await sellerCounts([row.seller.id]);
  return toModerationItem(row, counts.get(row.seller.id) ?? { active: 0, rejected: 0 });
}

// Человекочитаемая причина отклонения для уведомления продавцу (UC-15 шаг 4).
const REJECT_REASON_LABEL: Record<RejectInput['reason'], string> = {
  DUPLICATE: 'дубликат объявления',
  FRAUD_PRICE: 'подозрительная цена',
  MISLEADING_INFO: 'вводящая в заблуждение информация',
  OTHER: 'нарушение правил площадки',
};

/** UC-15 «одобрить»: PENDING_MODERATION → PUBLISHED, снять fraud-флаг, уведомить продавца. */
export async function approveListing(id: string): Promise<{ status: string }> {
  const target = await findModerationTarget(id);
  if (!target) throw new AppError(404, 'listing_not_found', 'Listing not found');
  assertTransition(target.status, 'PUBLISHED');

  const publishedAt = new Date();
  await decideListing(id, {
    status: 'PUBLISHED',
    publishedAt,
    expiresAt: computeExpiry(publishedAt), // срок 30 дней (BE-3.7)
    fraudFlag: false,
  });
  await invalidateCatalog(); // объявление появилось в каталоге (BE-4.2)
  await notify(target.sellerId, 'LISTING_STATUS', {
    title: 'Объявление опубликовано',
    message: 'Ваше объявление прошло модерацию и опубликовано в каталоге.',
    link: '/my-listings',
  });
  return { status: 'PUBLISHED' };
}

/** UC-15 «отклонить»: PENDING_MODERATION → REJECTED с обязательной причиной, уведомить. */
export async function rejectListing(id: string, input: RejectInput): Promise<{ status: string }> {
  const target = await findModerationTarget(id);
  if (!target) throw new AppError(404, 'listing_not_found', 'Listing not found');
  assertTransition(target.status, 'REJECTED');

  const reasonText = REJECT_REASON_LABEL[input.reason];
  const fraudReason = input.comment ? `${input.reason}: ${input.comment}` : input.reason;
  await decideListing(id, { status: 'REJECTED', fraudReason });
  await notify(target.sellerId, 'LISTING_STATUS', {
    title: 'Объявление отклонено',
    message: `Причина: ${reasonText}.${input.comment ? ` ${input.comment}` : ''} Исправьте и отправьте снова.`,
    link: '/my-listings',
  });
  return { status: 'REJECTED' };
}

export async function getUsers(): Promise<AdminUserRecord[]> {
  const rows = await findUsers();
  return rows.map(toAdminUserRecord);
}

// ACTIVE (снятие ограничения) → PHONE_VERIFIED: восстановить IDENTITY_VERIFIED
// нельзя без повторной верификации личности (схема хранит один статус) — задокументировано.
const STATUS_TO_VERIFICATION: Record<AdminUserStatus, VerificationStatus> = {
  ACTIVE: 'PHONE_VERIFIED',
  SUSPENDED: 'SUSPENDED',
  BANNED: 'BANNED',
};

/** UC-16: suspend/ban/restore одним вызовом (целевой статус явно). */
export async function setUserStatus(id: string, status: AdminUserStatus): Promise<AdminUserRecord> {
  const exists = await findUserStatus(id);
  if (!exists) throw new AppError(404, 'user_not_found', 'User not found');
  const row = await setUserVerification(id, STATUS_TO_VERIFICATION[status]);
  return toAdminUserRecord(row);
}

export async function getAnalytics(): Promise<AnalyticsCounts> {
  return analyticsCounts(new Date());
}
