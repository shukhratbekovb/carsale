import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { initChatHub } from './modules/chat/ws-hub.js';

const app = createApp();
const server = createServer(app);

// WebSocket Hub чата поверх того же http-сервера (BE-5.2). io присоединяется
// до начала приёма соединений; при сбое инициализации — не поднимаемся молча.
initChatHub(server)
  .then(() => {
    server.listen(env.PORT, () => {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, 'core-api started');
    });
  })
  .catch((err) => {
    logger.error({ err }, 'failed to initialize chat hub');
    process.exit(1);
  });
