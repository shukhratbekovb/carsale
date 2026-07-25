import { createHash } from 'node:crypto';
import { getRedis, isRedisConfigured } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';

/**
 * Redis-кэш каталога (BE-4.2, §6.6). Ответ GET /listings кэшируется на 60с.
 * Инвалидация — версионная: `catalog:ver` инкрементится при публикации/смене
 * состава каталога, версия входит в ключ → старые ключи «отваливаются» разом
 * (без дорогого удаления по маске). Всё fail-open: без Redis каталог просто
 * ходит в БД напрямую.
 */

const TTL_SEC = 60;
const VERSION_KEY = 'catalog:ver';

async function currentVersion(): Promise<string> {
  try {
    return (await getRedis().get(VERSION_KEY)) ?? '0';
  } catch {
    return '0';
  }
}

function cacheKey(version: string, canonicalQuery: string): string {
  const hash = createHash('sha1').update(canonicalQuery).digest('hex');
  return `catalog:v${version}:${hash}`;
}

export async function getCachedCatalog(canonicalQuery: string): Promise<unknown | null> {
  if (!isRedisConfigured()) return null;
  try {
    const version = await currentVersion();
    const raw = await getRedis().get(cacheKey(version, canonicalQuery));
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch (err) {
    logger.warn({ err }, 'catalog-cache: get failed (fail-open)');
    return null;
  }
}

export async function setCachedCatalog(canonicalQuery: string, body: unknown): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    const version = await currentVersion();
    await getRedis().set(cacheKey(version, canonicalQuery), JSON.stringify(body), 'EX', TTL_SEC);
  } catch (err) {
    logger.warn({ err }, 'catalog-cache: set failed (fail-open)');
  }
}

/** Инвалидировать весь кэш каталога (bump версии). Best-effort. */
export async function invalidateCatalog(): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    await getRedis().incr(VERSION_KEY);
    logger.info('catalog-cache: invalidated (version bumped)');
  } catch (err) {
    logger.warn({ err }, 'catalog-cache: invalidate failed');
  }
}
