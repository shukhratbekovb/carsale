import { pino } from 'pino';
import { env } from '../config/env.js';

// Структурированные JSON-логи (NFR-25); телефоны не логируются нигде (NFR-15)
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});
