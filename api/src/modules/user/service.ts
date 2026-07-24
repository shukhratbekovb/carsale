import { AppError } from '../../lib/errors.js';
import { addBusinessDays } from '../../lib/business-days.js';
import { logger } from '../../lib/logger.js';
import { revokeAllUserTokens } from '../../lib/jwt.js';
import {
  anonymizeAndSoftDelete,
  findProfile,
  gatherExport,
  setMarketingConsent,
  type ProfileRow,
} from './repository.js';

/**
 * User-сервис (BE-9, NFR-18–21, ЗРУ-547): профиль + согласия, экспорт данных,
 * запрос удаления (soft delete + анонимизация). Контракт — web/lib/gdpr/**,
 * но server-scope (реальные серверные данные, а не device-local мок фронта).
 */

// Raw-номер не хранится (только HMAC-хеш, NFR-15) → маскированный плейсхолдер,
// как в admin. Пользователь знает свой номер, но сервер его не восстановит.
const MASKED_PHONE = '+998 ** *** ** **';

export interface Consents {
  personalData: boolean;
  marketing: boolean;
  acceptedAt: string;
}

export interface Profile {
  id: string;
  phone: string;
  email: string | null;
  role: string;
  verificationStatus: string;
  createdAt: string;
  consents: Consents;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    phone: MASKED_PHONE,
    email: row.email,
    role: row.role,
    verificationStatus: row.verificationStatus,
    createdAt: row.createdAt.toISOString(),
    consents: {
      // Базовое ПД-согласие обязательно при регистрации (NFR-20) → всегда true;
      // момент принятия = регистрация (отдельного столбца нет, createdAt).
      personalData: true,
      marketing: row.marketingConsent,
      acceptedAt: row.createdAt.toISOString(),
    },
  };
}

export async function getProfile(userId: string): Promise<Profile> {
  const row = await findProfile(userId);
  if (!row) throw new AppError(404, 'user_not_found', 'User not found');
  return toProfile(row);
}

export async function updateConsents(userId: string, marketing: boolean): Promise<Consents> {
  const row = await setMarketingConsent(userId, marketing);
  return toProfile(row).consents;
}

export interface DataExport {
  exportedAt: string;
  device: false;
  [key: string]: unknown;
}

/** BE-9.2: серверный экспорт всех данных пользователя (JSON). */
export async function exportData(userId: string): Promise<DataExport> {
  const data = await gatherExport(userId);
  if (!data.profile) throw new AppError(404, 'user_not_found', 'User not found');
  return {
    exportedAt: new Date().toISOString(),
    device: false, // серверный экспорт, в отличие от device-scope фронт-мока
    profile: toProfile(data.profile),
    listings: data.listings.map((l) => ({
      ...l,
      priceUzs: l.priceUzs.toNumber(),
      createdAt: l.createdAt.toISOString(),
    })),
    favorites: data.favorites.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() })),
    savedSearches: data.savedSearches.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
    payments: data.payments.map((p) => ({
      ...p,
      amountUzs: p.amountUzs.toNumber(),
      createdAt: p.createdAt.toISOString(),
    })),
    notifications: data.notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
    })),
    messages: data.messages.map((m) => ({ ...m, sentAt: m.sentAt.toISOString() })),
  };
}

export interface DeletionReceipt {
  requestedAt: string;
  dueBy: string;
}

const DELETION_DUE_BUSINESS_DAYS = 15; // ЗРУ-547 ст. 19–22

/**
 * BE-9.3: запрос удаления аккаунта. Немедленный soft delete + анонимизация PII
 * (уже удовлетворяет «прекращение обработки», строже дедлайна) + отзыв всех
 * refresh-токенов. dueBy — законный максимум (информативно), фактически уже
 * выполнено. Идемпотентно: повторный запрос по уже удалённому — снова квитанция.
 */
export async function requestDeletion(userId: string): Promise<DeletionReceipt> {
  const row = await findProfile(userId);
  if (!row) throw new AppError(404, 'user_not_found', 'User not found');

  const requestedAt = new Date();
  if (!row.deletedAt) {
    await anonymizeAndSoftDelete(userId, requestedAt);
    await revokeAllUserTokens(userId).catch((err) => {
      logger.warn({ err, userId }, 'requestDeletion: failed to revoke refresh tokens');
    });
  }
  return {
    requestedAt: (row.deletedAt ?? requestedAt).toISOString(),
    dueBy: addBusinessDays(row.deletedAt ?? requestedAt, DELETION_DUE_BUSINESS_DAYS).toISOString(),
  };
}
