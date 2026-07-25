import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';

/**
 * Prometheus-метрики (BE-10.4, NFR-26). Единый Registry: дефолтные метрики
 * процесса/Node (CPU, RSS, event-loop lag, GC) + гистограмма длительности HTTP
 * (метод/маршрут/код). Экспорт — GET /metrics (app.ts). Дефолтные метрики не
 * собираем в тестах — их таймеры мешали бы vitest.
 */
export const registry = new Registry();
registry.setDefaultLabels({ service: 'core-api' });

if (process.env.NODE_ENV !== 'test') {
  collectDefaultMetrics({ register: registry });
}

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  // route — нормализованный шаблон (req.baseUrl+route.path), не сырой URL,
  // чтобы не взорвать кардинальность (NFR-26). status_code — строкой.
  labelNames: ['method', 'route', 'status_code'],
  // p95 ≤ 2с (NFR-1) попадает между бакетами для наглядности хвоста
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});
