import type { User } from '@prisma/client';
import { getPrisma } from '../../lib/prisma.js';

/**
 * Доступ к USER для auth-модуля (BE-1.3). Единственная точка, где auth
 * пишет/читает таблицу users (границы модулей — ADR-006).
 */

export interface FindOrCreateResult {
  user: User;
  isNew: boolean;
}

/**
 * Находит пользователя по phone_hash или создаёт нового.
 * Новый: role BUYER, verification PHONE_VERIFIED (§6.1 — вход по OTP подтверждает
 * телефон). Существующий: обновляет маркетинговое согласие и, если был UNVERIFIED,
 * поднимает до PHONE_VERIFIED (не трогая IDENTITY_VERIFIED/SUSPENDED/BANNED).
 */
export async function findOrCreateByPhoneHash(
  phoneHash: string,
  marketingConsent: boolean,
): Promise<FindOrCreateResult> {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { phoneHash } });

  if (!existing) {
    const user = await prisma.user.create({
      data: {
        phoneHash,
        role: 'BUYER',
        verificationStatus: 'PHONE_VERIFIED',
        marketingConsent,
      },
    });
    return { user, isNew: true };
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      marketingConsent,
      verificationStatus:
        existing.verificationStatus === 'UNVERIFIED'
          ? 'PHONE_VERIFIED'
          : existing.verificationStatus,
    },
  });
  return { user, isNew: false };
}

export async function findById(id: string): Promise<User | null> {
  return getPrisma().user.findUnique({ where: { id } });
}
