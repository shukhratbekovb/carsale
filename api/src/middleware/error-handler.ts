import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Resource not found', code: 'not_found' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Express распознаёт error-middleware только по арности 4
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'validation_error',
      details: { issues: err.issues },
    });
    return;
  }
  // Ошибки загрузки файла (multer): превышение размера и т.п. → 400, не 500
  if (err instanceof MulterError) {
    res.status(400).json({
      error: err.message,
      code: err.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : 'upload_error',
    });
    return;
  }
  logger.error({ err, requestId: res.locals.requestId }, 'unhandled error');
  res.status(500).json({ error: 'Internal server error', code: 'internal_error' });
}
