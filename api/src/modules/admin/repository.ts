import { Prisma } from '@prisma/client';
import type { ListingStatus, VerificationStatus } from '@prisma/client';
import { getPrisma } from '../../lib/prisma.js';
import {
  adminUserSelect,
  moderationSelect,
  type AdminUserRow,
  type ModerationRow,
  type SellerCounts,
} from './mapper.js';

/**
 * Доступ к данным admin-панели (BE-8). Admin — привилегированный кросс-модуль
 * (модерация листингов + управление пользователями): читает/пишет таблицы
 * listings/users напрямую, что оправдано его ролью (единая точка модерации),
 * в отличие от продуктовых модулей (ADR-006).
 */

/** Очередь модерации (UC-15 шаг 2): PENDING_MODERATION, «сначала старые». */
export async function findModerationQueue(): Promise<ModerationRow[]> {
  return getPrisma().listing.findMany({
    where: { status: 'PENDING_MODERATION' },
    select: moderationSelect,
    orderBy: { createdAt: 'asc' },
  });
}

export async function findModerationItem(id: string): Promise<ModerationRow | null> {
  return getPrisma().listing.findUnique({ where: { id }, select: moderationSelect });
}

/** Счётчики объявлений продавцов (активные/отклонённые) одним groupBy. */
export async function sellerCounts(sellerIds: string[]): Promise<Map<string, SellerCounts>> {
  const result = new Map<string, SellerCounts>();
  if (sellerIds.length === 0) return result;
  const rows = await getPrisma().listing.groupBy({
    by: ['sellerId', 'status'],
    where: { sellerId: { in: sellerIds } },
    _count: { _all: true },
  });
  for (const id of sellerIds) result.set(id, { active: 0, rejected: 0 });
  for (const r of rows) {
    const entry = result.get(r.sellerId);
    if (!entry) continue;
    if (r.status === 'PUBLISHED') entry.active += r._count._all;
    else if (r.status === 'REJECTED') entry.rejected += r._count._all;
  }
  return result;
}

export interface ModerationTarget {
  id: string;
  status: ListingStatus;
  sellerId: string;
}

export async function findModerationTarget(id: string): Promise<ModerationTarget | null> {
  return getPrisma().listing.findUnique({
    where: { id },
    select: { id: true, status: true, sellerId: true },
  });
}

export interface DecideListingData {
  status: ListingStatus;
  publishedAt?: Date;
  expiresAt?: Date;
  fraudFlag?: boolean;
  fraudReason?: string | null;
}

export async function decideListing(id: string, data: DecideListingData): Promise<void> {
  await getPrisma().listing.update({
    where: { id },
    data: {
      status: data.status,
      ...(data.publishedAt !== undefined ? { publishedAt: data.publishedAt } : {}),
      ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      ...(data.fraudFlag !== undefined ? { fraudFlag: data.fraudFlag } : {}),
      ...(data.fraudReason !== undefined ? { fraudReason: data.fraudReason } : {}),
    },
  });
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function findUsers(): Promise<AdminUserRow[]> {
  return getPrisma().user.findMany({
    where: { deletedAt: null },
    select: adminUserSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function findUserStatus(id: string): Promise<{ id: string } | null> {
  return getPrisma().user.findUnique({ where: { id }, select: { id: true } });
}

export async function setUserVerification(id: string, vs: VerificationStatus): Promise<AdminUserRow> {
  return getPrisma().user.update({
    where: { id },
    data: { verificationStatus: vs },
    select: adminUserSelect,
  });
}

// ── Audit log (BE-8.5, UC-15/16, NFR-16) ──────────────────────────────────────

export type AdminAction = 'LISTING_APPROVE' | 'LISTING_REJECT' | 'USER_STATUS_CHANGE';

export interface AuditLogEntry {
  adminId: string;
  action: AdminAction;
  targetType: 'LISTING' | 'USER';
  targetId: string;
  metadata?: Prisma.InputJsonValue;
}

/** Записать действие админа в append-only журнал. Один и тот же Postgres, что и
 *  сама мутация, — отдельной best-effort-логики не требует (см. service). */
export async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  await getPrisma().adminAuditLog.create({
    data: {
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata ?? Prisma.JsonNull,
    },
  });
}

export interface AuditLogRow {
  id: string;
  adminId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}

/** Журнал «сначала свежие», ограничение размера (пагинация не нужна на текущих объёмах). */
export async function findAuditLogs(limit: number): Promise<AuditLogRow[]> {
  return getPrisma().adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      adminId: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
    },
  });
}

// ── Analytics (UC-17) ─────────────────────────────────────────────────────────

export interface AnalyticsCounts {
  totalListings: number;
  activeListings: number;
  pendingModeration: number;
  rejectedListings: number;
  totalUsers: number;
  activeUsers30d: number;
  newListings7d: number;
  newUsers7d: number;
}

export async function analyticsCounts(now: Date): Promise<AnalyticsCounts> {
  const prisma = getPrisma();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [
    totalListings,
    activeListings,
    pendingModeration,
    rejectedListings,
    totalUsers,
    activeUsers30d,
    newListings7d,
    newUsers7d,
  ] = await Promise.all([
    prisma.listing.count(),
    prisma.listing.count({ where: { status: 'PUBLISHED' } }),
    prisma.listing.count({ where: { status: 'PENDING_MODERATION' } }),
    prisma.listing.count({ where: { status: 'REJECTED' } }),
    prisma.user.count({ where: { deletedAt: null } }),
    // MAU: нет журнала активности → прокси «обновлялись за 30 дней» (задокументировано)
    prisma.user.count({ where: { deletedAt: null, updatedAt: { gte: d30 } } }),
    prisma.listing.count({ where: { createdAt: { gte: d7 } } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: d7 } } }),
  ]);
  return {
    totalListings,
    activeListings,
    pendingModeration,
    rejectedListings,
    totalUsers,
    activeUsers30d,
    newListings7d,
    newUsers7d,
  };
}
