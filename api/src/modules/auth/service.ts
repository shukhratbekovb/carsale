import type { User } from '@prisma/client';
import { AppError } from '../../lib/errors.js';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  signAccessToken,
  type Role,
} from '../../lib/jwt.js';
import { hashPhone, normalizePhone } from '../../lib/phone.js';
import { createOtpService, type OtpService } from './otp-service.js';
import { createSmsGateway } from './sms-gateway.js';
import { findById, findOrCreateByPhoneHash } from './user-repository.js';
import type { VerifyOtpInput } from './validation.js';

/**
 * Auth-сервис (BE-1.3): склеивает phone-нормализацию, OTP-сервис, USER-репозиторий
 * и JWT. Оркестрация §6.1 (send → verify → выдача токенов).
 */

export interface PublicUser {
  id: string;
  role: Role;
  verification_status: string;
  email: string | null;
  marketing_consent: boolean;
  created_at: string;
}

// Наружу не отдаём phone_hash / deleted_at (BR-3, NFR-15)
function toPublic(user: User): PublicUser {
  return {
    id: user.id,
    role: user.role,
    verification_status: user.verificationStatus,
    email: user.email,
    marketing_consent: user.marketingConsent,
    created_at: user.createdAt.toISOString(),
  };
}

function assertLoginAllowed(user: User): void {
  // Удалённый аккаунт (BE-9.3): PII анонимизирован, вход/refresh запрещён
  if (user.deletedAt) {
    throw new AppError(403, 'account_deleted', 'This account has been deleted');
  }
  if (user.verificationStatus === 'BANNED') {
    throw new AppError(403, 'account_banned', 'This account is banned');
  }
  if (user.verificationStatus === 'SUSPENDED') {
    throw new AppError(403, 'account_suspended', 'This account is suspended');
  }
}

export interface AuthService {
  requestOtp(phone: string): Promise<{ expiresIn: number }>;
  verify(input: VerifyOtpInput): Promise<{
    user: PublicUser;
    accessToken: string;
    refreshToken: string;
    isNew: boolean;
  }>;
  refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }>;
  logout(refreshToken: string): Promise<void>;
}

export function createAuthService(otpService: OtpService): AuthService {
  return {
    async requestOtp(phone) {
      const canonical = normalizePhone(phone);
      return otpService.requestOtp(canonical);
    },

    async verify(input) {
      const canonical = normalizePhone(input.phone);
      await otpService.verifyOtp(canonical, input.code);

      const phoneHash = hashPhone(canonical);
      const { user, isNew } = await findOrCreateByPhoneHash(phoneHash, input.marketingConsent);
      assertLoginAllowed(user);

      const accessToken = signAccessToken(user.id, user.role);
      const refreshToken = await issueRefreshToken(user.id);
      return { user: toPublic(user), accessToken, refreshToken, isNew };
    },

    async refresh(token) {
      const { userId, refreshToken } = await rotateRefreshToken(token);
      const user = await findById(userId);
      if (!user) {
        throw new AppError(401, 'invalid_token', 'User no longer exists');
      }
      assertLoginAllowed(user);
      return { accessToken: signAccessToken(user.id, user.role), refreshToken };
    },

    async logout(token) {
      await revokeRefreshToken(token);
    },
  };
}

// Экземпляр по умолчанию для роутера: OTP-сервис поверх выбранного SMS-шлюза.
let defaultService: AuthService | null = null;
export function getAuthService(): AuthService {
  if (!defaultService) {
    defaultService = createAuthService(createOtpService(createSmsGateway()));
  }
  return defaultService;
}
