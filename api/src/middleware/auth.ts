import type { RequestHandler, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { type AccessClaims, type Role, verifyAccessToken } from '../lib/jwt.js';

/**
 * RBAC middleware (BE-1.5, 09-architecture §5). requireAuth проверяет
 * Bearer access-токен и кладёт клеймы в res.locals.auth; requireRole
 * гейтит по роли (GUEST/BUYER/SELLER/ADMIN). Порядок: requireAuth → requireRole.
 */

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'unauthorized', 'Missing bearer token'));
    return;
  }
  try {
    res.locals.auth = verifyAccessToken(header.slice('Bearer '.length));
    next();
  } catch (err) {
    next(err);
  }
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (_req, res, next) => {
    const auth = res.locals.auth as AccessClaims | undefined;
    if (!auth) {
      next(new AppError(401, 'unauthorized', 'Not authenticated'));
      return;
    }
    if (!roles.includes(auth.role)) {
      next(new AppError(403, 'forbidden', 'Insufficient role'));
      return;
    }
    next();
  };
}

/** Достаёт клеймы авторизованного пользователя (после requireAuth). */
export function getAuth(res: Response): AccessClaims {
  const auth = res.locals.auth as AccessClaims | undefined;
  if (!auth) throw new AppError(401, 'unauthorized', 'Not authenticated');
  return auth;
}
