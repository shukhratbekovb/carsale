import type { RequestHandler } from 'express';
import { httpRequestDuration } from '../lib/metrics.js';

/**
 * Замеряет длительность HTTP-запроса и пишет в гистограмму (BE-10.4). Маршрут
 * нормализуем в шаблон (`/listings/:id`, не `/listings/<uuid>`) через req.route,
 * известный к моменту `finish`; несопоставленные (404) → 'unmatched', чтобы
 * произвольные пути не раздували кардинальность.
 */
export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route
      ? `${req.baseUrl}${req.route.path as string}`
      : req.baseUrl || 'unmatched';
    end({ method: req.method, route, status_code: String(res.statusCode) });
  });
  next();
};
