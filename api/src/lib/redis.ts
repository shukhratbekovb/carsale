import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { AppError } from './errors.js';
import { logger } from './logger.js';

/**
 * Обёртка над ioredis (BE-0.8).
 * Ленивый синглтон: импорт модуля никогда не открывает соединение сам по себе
 * (lazyConnect) — каркас обязан подниматься без docker-compose (BE-0.4).
 */
let client: Redis | null = null;

/** Redis сконфигурирован? Для fail-open потребителей (rate limit в dev без docker). */
export function isRedisConfigured(): boolean {
  return Boolean(env.REDIS_URL);
}

/**
 * Возвращает ленивый Redis-клиент. Бросает внятную ошибку конфигурации,
 * если REDIS_URL не задан — модуль, которому нужен Redis, падает на старте
 * своего клиента, а не где-то глубоко в рантайме.
 */
export function getRedis(): Redis {
  if (!env.REDIS_URL) {
    throw new AppError(
      503,
      'redis_not_configured',
      'REDIS_URL is not set — Redis-backed features are unavailable (start infra/docker-compose and set REDIS_URL)',
    );
  }
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
    client.on('error', (err) => {
      logger.warn({ err }, 'redis connection error');
    });
  }
  return client;
}

/** Закрыть соединение (graceful shutdown / тесты). */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }
}
