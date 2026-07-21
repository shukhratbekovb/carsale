import { createHmac, randomInt } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { getRedis } from '../../lib/redis.js';
import type { SmsGateway } from './sms-gateway.js';

/**
 * OTP-сервис на Redis (BE-1.2). Семантика — docs/analysis/06-sequence-diagrams.md §6.1
 * и §3.1; поведение согласовано с фронтовым флоу (web/lib/auth/otp-flow.ts):
 *   - код живёт 300с
 *   - повторная отправка не чаще, чем раз в 60с (anti-spam cooldown)
 *   - 3 неверные попытки → блокировка на 15 мин
 * Код в Redis хранится в виде HMAC-хеша (raw-код не персистится).
 */

export const OTP_TTL_SEC = 300;
export const OTP_COOLDOWN_SEC = 60;
export const OTP_LOCK_SEC = 900;
export const OTP_MAX_ATTEMPTS = 3;

const otpKey = (phone: string): string => `otp:${phone}`;
const cooldownKey = (phone: string): string => `otp:cd:${phone}`;
const lockKey = (phone: string): string => `otp:lock:${phone}`;

const hashCode = (code: string): string =>
  createHmac('sha256', env.OTP_HASH_SECRET).update(code).digest('hex');

export interface OtpService {
  requestOtp(phone: string): Promise<{ expiresIn: number }>;
  verifyOtp(phone: string, code: string): Promise<void>;
}

/** Округление TTL в секундах вверх; PTTL<0 (нет ключа/TTL) → фолбэк. */
const retryAfterFromPttl = (pttlMs: number, fallbackSec: number): number =>
  pttlMs > 0 ? Math.ceil(pttlMs / 1000) : fallbackSec;

export function createOtpService(gateway: SmsGateway): OtpService {
  return {
    async requestOtp(phone: string): Promise<{ expiresIn: number }> {
      const redis = getRedis();

      const cdPttl = await redis.pttl(cooldownKey(phone));
      if (cdPttl > 0) {
        throw new AppError(429, 'otp_cooldown', 'OTP was requested too recently', {
          retry_after: retryAfterFromPttl(cdPttl, OTP_COOLDOWN_SEC),
        });
      }

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      // Сохраняем хеш + счётчик попыток атомарно с TTL
      await redis
        .multi()
        .hset(otpKey(phone), { hash: hashCode(code), attempts: 0 })
        .expire(otpKey(phone), OTP_TTL_SEC)
        .exec();

      try {
        await gateway.sendOtp(phone, code);
      } catch (err) {
        // Откат записи, если SMS не ушла (§3.1) — пользователь сможет повторить сразу
        await redis.del(otpKey(phone));
        throw err;
      }

      // Ставим cooldown только после успешной отправки
      await redis.set(cooldownKey(phone), '1', 'EX', OTP_COOLDOWN_SEC);
      return { expiresIn: OTP_TTL_SEC };
    },

    async verifyOtp(phone: string, code: string): Promise<void> {
      const redis = getRedis();

      const lockPttl = await redis.pttl(lockKey(phone));
      if (lockPttl > 0) {
        throw new AppError(429, 'otp_locked', 'Too many attempts, try again later', {
          retry_after: retryAfterFromPttl(lockPttl, OTP_LOCK_SEC),
        });
      }

      const record = await redis.hgetall(otpKey(phone));
      if (!record.hash) {
        throw new AppError(400, 'otp_expired', 'OTP has expired or was never requested');
      }

      if (record.hash === hashCode(code)) {
        await redis.del(otpKey(phone));
        return;
      }

      // Неверный код: инкремент попыток; на 3-й — блокировка
      const attempts = await redis.hincrby(otpKey(phone), 'attempts', 1);
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await redis
          .multi()
          .del(otpKey(phone))
          .set(lockKey(phone), '1', 'EX', OTP_LOCK_SEC)
          .exec();
        throw new AppError(429, 'otp_locked', 'Too many attempts, try again later', {
          retry_after: OTP_LOCK_SEC,
        });
      }

      throw new AppError(400, 'invalid_otp', 'Invalid code', {
        attempts_left: OTP_MAX_ATTEMPTS - attempts,
      });
    },
  };
}
