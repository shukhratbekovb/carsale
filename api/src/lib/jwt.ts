import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errors.js';
import { getRedis } from './redis.js';

/**
 * JWT-сессии (BE-1.4, 09-architecture §5):
 *   - access token — 15 мин, несёт sub + role, проверяется stateless
 *   - refresh token — 30 дней, хранится в httpOnly cookie; jti занесён в
 *     Redis-allowlist, чтобы уметь инвалидировать (logout / rotation)
 * Ротация: на /refresh старый jti удаляется, выдаётся новый (одноразовость).
 */

export const ACCESS_TTL = '15m';
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;

export type Role = 'BUYER' | 'SELLER' | 'ADMIN';

export interface AccessClaims {
  sub: string;
  role: Role;
}

interface RefreshClaims {
  sub: string;
  jti: string;
  typ: 'refresh';
}

const refreshRedisKey = (userId: string, jti: string): string => `refresh:${userId}:${jti}`;

export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role, typ: 'access' }, env.JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

/** Выпустить refresh: генерирует jti, заносит в Redis-allowlist с TTL, подписывает. */
export async function issueRefreshToken(userId: string): Promise<string> {
  const jti = randomUUID();
  await getRedis().set(refreshRedisKey(userId, jti), '1', 'EX', REFRESH_TTL_SEC);
  return jwt.sign({ sub: userId, jti, typ: 'refresh' }, env.JWT_SECRET, {
    expiresIn: REFRESH_TTL_SEC,
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, 'invalid_token', 'Access token is invalid or expired');
  }
  if (payload['typ'] !== 'access' || typeof payload.sub !== 'string') {
    throw new AppError(401, 'invalid_token', 'Not an access token');
  }
  return { sub: payload.sub, role: payload['role'] as Role };
}

/** Проверяет подпись refresh и наличие jti в allowlist (иначе — отозван). */
async function verifyRefreshToken(token: string): Promise<RefreshClaims> {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, 'invalid_token', 'Refresh token is invalid or expired');
  }
  if (
    payload['typ'] !== 'refresh' ||
    typeof payload.sub !== 'string' ||
    typeof payload['jti'] !== 'string'
  ) {
    throw new AppError(401, 'invalid_token', 'Not a refresh token');
  }
  const jti = payload['jti'];
  const exists = await getRedis().get(refreshRedisKey(payload.sub, jti));
  if (!exists) {
    throw new AppError(401, 'token_revoked', 'Refresh token has been revoked');
  }
  return { sub: payload.sub, jti, typ: 'refresh' };
}

/**
 * Ротация: проверяет refresh, удаляет старый jti (одноразовость), выдаёт новую
 * пару. Возвращает userId, чтобы вызывающий подтянул роль для access-токена.
 */
export async function rotateRefreshToken(
  token: string,
): Promise<{ userId: string; refreshToken: string }> {
  const { sub, jti } = await verifyRefreshToken(token);
  await getRedis().del(refreshRedisKey(sub, jti));
  const refreshToken = await issueRefreshToken(sub);
  return { userId: sub, refreshToken };
}

/** Logout: инвалидирует refresh (idempotent — молча игнорирует битый/отозванный). */
export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub === 'string' && typeof payload['jti'] === 'string') {
      await getRedis().del(refreshRedisKey(payload.sub, payload['jti']));
    }
  } catch {
    // битый/просроченный токен — инвалидировать нечего
  }
}
