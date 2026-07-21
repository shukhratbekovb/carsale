import type { ListingStatus } from '@prisma/client';
import { AppError } from '../../lib/errors.js';

/**
 * Статусная машина объявления (BE-3.2) — переходы по docs/analysis/07-process-and-state.md §2.1.
 * Чистый модуль без БД: описывает разрешённые переходы и валидирует их.
 */

const TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  DRAFT: ['PENDING_MODERATION'],
  PENDING_MODERATION: ['PUBLISHED', 'REJECTED'],
  PUBLISHED: ['PENDING_MODERATION', 'ARCHIVED', 'SOLD', 'EXPIRED'],
  REJECTED: ['DRAFT'],
  ARCHIVED: ['DRAFT'],
  SOLD: [],
  EXPIRED: [],
};

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Бросает 409, если переход недопустим — единый способ гейтить смену статуса. */
export function assertTransition(from: ListingStatus, to: ListingStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(409, 'invalid_status_transition', `Cannot move listing from ${from} to ${to}`, {
      from,
      to,
    });
  }
}

/** Статусы, из которых продавец может редактировать черновик (DRAFT напрямую, REJECTED — после правки). */
export function isEditable(status: ListingStatus): boolean {
  return status === 'DRAFT' || status === 'REJECTED';
}
