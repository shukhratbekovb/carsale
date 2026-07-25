import cookieParser from 'cookie-parser';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger.js';
import { registry } from './lib/metrics.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { rateLimit } from './middleware/rate-limit.js';
import { requestId } from './middleware/request-id.js';
import { securityHeaders } from './middleware/security-headers.js';
import { adminRouter } from './modules/admin/router.js';
import { authRouter } from './modules/auth/router.js';
import { catalogRouter } from './modules/catalog/router.js';
import { chatRouter } from './modules/chat/router.js';
import { listingRouter, myListingsRouter } from './modules/listing/router.js';
import { notificationRouter } from './modules/notification/router.js';
import { paymentsRouter, webhooksRouter } from './modules/payment/router.js';
import { userRouter } from './modules/user/router.js';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  // Заголовки безопасности до всех роутов (BE-10.5, NFR-12) — покрывают и /health
  app.use(securityHeaders);
  // Замер длительности всех запросов в Prometheus-гистограмму (BE-10.4)
  app.use(metricsMiddleware);
  app.use(pinoHttp({ logger, genReqId: (_req, res) => res.locals.requestId as string }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'core-api', uptime: process.uptime() });
  });

  // Экспорт метрик для Prometheus (BE-10.4, NFR-26) — до rate-limit (скрейп не
  // лимитируем), как /health. В проде эндпоинт закрывается сетью/фаерволом.
  app.get('/metrics', (_req, res) => {
    void registry.metrics().then((body) => {
      res.set('Content-Type', registry.contentType);
      res.end(body);
    });
  });

  // Rate-limit гостя 60 req/мин на IP (BE-0.7, NFR-14) — после /health (мониторинг
  // не лимитируем), до роутов. Без Redis fail-open. Auth-тир 300 req/мин подключит
  // отдельный лимитер с keyFn = user id, когда понадобится (фабрика уже готова).
  app.use(rateLimit());

  app.use('/auth', authRouter);
  // catalog (публичное чтение GET /listings) монтируется раньше listing (мутации продавца):
  // внутри catalog только GET-хендлеры, остальное проваливается дальше в listing
  app.use('/listings', catalogRouter);
  app.use('/listings', listingRouter);
  app.use('/my', myListingsRouter);
  app.use('/chat', chatRouter);
  app.use('/payments', paymentsRouter);
  app.use('/webhooks', webhooksRouter);
  app.use('/notifications', notificationRouter);
  app.use('/me', userRouter);
  app.use('/admin', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
