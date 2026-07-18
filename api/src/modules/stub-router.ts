import { Router } from 'express';
import { notImplemented } from '../lib/errors.js';

/**
 * Заглушка модуля: известные маршруты контракта отвечают 501 not_implemented,
 * чтобы фронтенд и e2e могли отличить «ещё не реализовано» от 404.
 * Каждый модуль заменяет заглушку на router → service → repository (ADR-006).
 */
export function stubRouter(moduleName: string): Router {
  const router = Router();
  router.use((_req, _res, next) => next(notImplemented(moduleName)));
  return router;
}
