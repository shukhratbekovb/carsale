import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { initChatHub } from './modules/chat/ws-hub.js';
import { startFraudConsumer } from './modules/listing/fraud-consumer.js';
import { startDeliveryConsumer } from './modules/notification/delivery-consumer.js';

const app = createApp();
const server = createServer(app);

// WebSocket Hub чата поверх того же http-сервера (BE-5.2). io присоединяется
// до начала приёма соединений; при сбое инициализации — не поднимаемся молча.
initChatHub(server)
  .then(() => {
    server.listen(env.PORT, () => {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, 'core-api started');
    });
    // Consumer очереди fraud_check (BE-3.6) — best-effort: без RabbitMQ сервер
    // всё равно поднимается (события накапливаются, разберём при доступности).
    startFraudConsumer().catch((err) => {
      logger.warn({ err }, 'fraud-consumer: failed to subscribe (queue unavailable?)');
    });
    // Consumer внешней доставки уведомлений (BE-7.2/7.3) — тоже best-effort.
    startDeliveryConsumer().catch((err) => {
      logger.warn({ err }, 'delivery-consumer: failed to subscribe (queue unavailable?)');
    });
  })
  .catch((err) => {
    logger.error({ err }, 'failed to initialize chat hub');
    process.exit(1);
  });
