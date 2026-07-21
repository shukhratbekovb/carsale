import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Оборачивает async-обработчик так, чтобы отклонённый промис уходил в
 * next(err) — Express 4 сам не ловит ошибки из async-хендлеров.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
