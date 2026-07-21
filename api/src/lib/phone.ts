import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

/**
 * Нормализация и хеширование телефона (BE-1.6, NFR-15).
 * Raw-телефон НИКОГДА не логируется — ни здесь, ни в вызывающем коде.
 */

const UZ_PHONE_RE = /^\+?998(\d{9})$/;

/**
 * Строгая нормализация узбекского номера в канонический вид `998XXXXXXXXX`.
 * Принимает `+998…` / `998…` с пробелами, дефисами и скобками; всё остальное —
 * AppError(400, 'invalid_phone').
 */
export function normalizePhone(input: string): string {
  const cleaned = input.replace(/[\s\-()]/g, '');
  const match = UZ_PHONE_RE.exec(cleaned);
  if (!match) {
    throw new AppError(
      400,
      'invalid_phone',
      'Phone must be a valid Uzbekistan number: +998XXXXXXXXX',
    );
  }
  return `998${match[1]}`;
}

/**
 * Детерминированный хеш телефона для колонки `phone_hash`.
 *
 * ОСОЗНАННОЕ ОТКЛОНЕНИЕ от docs/analysis/05 (NFR-15): там указан bcrypt/Argon2,
 * но их случайная соль делает хеш недетерминированным — а 08-data-model требует
 * UNIQUE-индекс по phone_hash и поиск пользователя по номеру (login-флоу §6.1).
 * Рабочее решение: keyed HMAC-SHA256 с секретом PHONE_HASH_SECRET из окружения —
 * детерминированный, но без секрета не поддаётся перебору по словарю номеров.
 *
 * Ожидает канонический номер (`normalizePhone`) — иначе один номер даст разные хеши.
 */
export function hashPhone(phone: string): string {
  return createHmac('sha256', env.PHONE_HASH_SECRET).update(phone).digest('hex');
}
