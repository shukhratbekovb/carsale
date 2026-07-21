import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

/**
 * Ленивый синглтон PrismaClient (по прецеденту redis.ts): импорт модуля
 * не открывает соединение — каркас поднимается без БД. Модуль, которому
 * нужна БД, падает с внятной ошибкой на первом getPrisma().
 */
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!env.DATABASE_URL) {
    throw new AppError(
      503,
      'db_not_configured',
      'DATABASE_URL is not set — database features are unavailable (start infra/docker-compose)',
    );
  }
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}

export async function closePrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
