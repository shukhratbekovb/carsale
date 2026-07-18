import type { Request, RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { getRedis, isRedisConfigured } from '../lib/redis.js';

/**
 * Rate limiting на Redis, fixed window — BE-0.7 / NFR-14.
 * Гость: 60 req/мин на IP; аутентифицированный: 300 req/мин на пользователя —
 * auth ещё не реализован, поэтому фабрика принимает keyFn: когда появится
 * BE-1.4, аутентифицированный лимитер подключается через keyFn = req.user.id.
 *
 * Превышение → 429 { error, code: 'rate_limited', details: { retry_after } }
 * + заголовок Retry-After (через AppError и общий error-handler).
 *
 * Без REDIS_URL (dev без docker) — fail-open с одним warn-логом, не падаем.
 */

export interface RateLimitOptions {
  /** Окно в мс (по умолчанию 60 000 — минута, как в NFR-14). */
  windowMs?: number;
  /** Максимум запросов в окне (по умолчанию 60 — гость). */
  max?: number;
  /** Ключ субъекта лимита; по умолчанию IP. Для auth — подставить user id. */
  keyFn?: (req: Request) => string;
  /** Префикс Redis-ключей — разделяет независимые лимитеры. */
  prefix?: string;
}

export function rateLimit(options: RateLimitOptions = {}): RequestHandler {
  const {
    windowMs = 60_000,
    max = 60,
    keyFn = (req) => req.ip ?? 'unknown',
    prefix = 'rl',
  } = options;

  let warnedFailOpen = false;
  const warnFailOpenOnce = (reason: string, err?: unknown): void => {
    if (warnedFailOpen) return;
    warnedFailOpen = true;
    logger.warn({ ...(err !== undefined ? { err } : {}), prefix }, reason);
  };

  return async (req, res, next) => {
    if (!isRedisConfigured()) {
      warnFailOpenOnce('rate-limit: REDIS_URL is not set — fail-open, limiting disabled');
      next();
      return;
    }

    try {
      const redis = getRedis();
      const now = Date.now();
      const windowIndex = Math.floor(now / windowMs);
      const key = `${prefix}:${keyFn(req)}:${windowIndex}`;

      // INCR + PEXPIRE NX в одной MULTI-транзакции: атомарно, TTL ставится
      // только первым запросом окна (Redis 7)
      const results = await redis.multi().incr(key).pexpire(key, windowMs, 'NX').exec();
      const incrResult = results?.[0];
      if (incrResult?.[0]) throw incrResult[0];
      const count = Number(incrResult?.[1] ?? 0);

      if (count > max) {
        const retryAfterSec = Math.max(1, Math.ceil(((windowIndex + 1) * windowMs - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));
        next(
          new AppError(429, 'rate_limited', 'Too many requests', {
            retry_after: retryAfterSec,
          }),
        );
        return;
      }
      next();
    } catch (err) {
      // Redis недоступен в рантайме — деградируем открыто, не роняем трафик
      warnFailOpenOnce('rate-limit: Redis unavailable — fail-open for this limiter', err);
      next();
    }
  };
}
