import amqp from 'amqplib';
import type { Channel, ConsumeMessage } from 'amqplib';
import { env } from '../config/env.js';
import { AppError } from './errors.js';
import { logger } from './logger.js';

/**
 * Обёртка над RabbitMQ / amqplib (BE-0.8).
 * Ленивое подключение + авто-reconnect с экспоненциальным backoff.
 * Семантика at-least-once (09-architecture §5): durable-очереди, persistent-сообщения,
 * явный ack; при ошибке обработчика — nack без requeue (после логирования),
 * чтобы «ядовитое» сообщение не крутилось бесконечно.
 */

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

export type QueueHandler = (payload: unknown, raw: ConsumeMessage) => void | Promise<void>;

let connection: AmqpConnection | null = null;
let channel: Channel | null = null;
let channelPromise: Promise<Channel> | null = null;
let reconnectAttempt = 0;
let shuttingDown = false;

/** Зарегистрированные консьюмеры — пересоздаются после reconnect. */
const consumers = new Map<string, QueueHandler>();

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

function requireUrl(): string {
  if (!env.RABBITMQ_URL) {
    throw new AppError(
      503,
      'rabbitmq_not_configured',
      'RABBITMQ_URL is not set — queue features are unavailable (start infra/docker-compose and set RABBITMQ_URL)',
    );
  }
  return env.RABBITMQ_URL;
}

function scheduleReconnect(): void {
  if (shuttingDown) return;
  reconnectAttempt += 1;
  const delayMs = Math.min(RECONNECT_BASE_MS * 2 ** (reconnectAttempt - 1), RECONNECT_MAX_MS);
  logger.warn({ attempt: reconnectAttempt, delayMs }, 'rabbitmq: connection lost, reconnect scheduled');
  const timer = setTimeout(() => {
    void (async () => {
      try {
        const ch = await getChannel();
        for (const [queueName, handler] of consumers) {
          await bindConsumer(ch, queueName, handler);
        }
        logger.info({ consumers: consumers.size }, 'rabbitmq: reconnected');
      } catch (err) {
        logger.error({ err }, 'rabbitmq: reconnect attempt failed');
        scheduleReconnect();
      }
    })();
  }, delayMs);
  timer.unref();
}

async function getChannel(): Promise<Channel> {
  if (channel) return channel;
  if (!channelPromise) {
    channelPromise = (async () => {
      const conn = await amqp.connect(requireUrl());
      conn.on('error', (err: unknown) => {
        logger.warn({ err }, 'rabbitmq: connection error');
      });
      conn.on('close', () => {
        connection = null;
        channel = null;
        channelPromise = null;
        scheduleReconnect();
      });
      const ch = await conn.createChannel();
      connection = conn;
      channel = ch;
      reconnectAttempt = 0;
      return ch;
    })().catch((err: unknown) => {
      channelPromise = null;
      throw err;
    });
  }
  return channelPromise;
}

async function bindConsumer(ch: Channel, queueName: string, handler: QueueHandler): Promise<void> {
  await ch.assertQueue(queueName, { durable: true });
  await ch.consume(queueName, async (msg) => {
    if (!msg) return; // консьюмер отменён сервером
    try {
      const payload: unknown = JSON.parse(msg.content.toString('utf8'));
      await handler(payload, msg);
      ch.ack(msg);
    } catch (err) {
      logger.error({ err, queue: queueName }, 'rabbitmq: handler failed — nack without requeue');
      ch.nack(msg, false, false);
    }
  });
  // Логируем ФАКТ биндинга (initial или после reconnect) — достоверный сигнал,
  // в отличие от «registered» в consumeQueue, который резолвится и при отложенном ретрае
  logger.info({ queue: queueName }, 'rabbitmq: consumer bound');
}

/** Публикация события: JSON, persistent, в durable-очередь. */
export async function publishEvent(queueName: string, payload: object): Promise<void> {
  const ch = await getChannel();
  await ch.assertQueue(queueName, { durable: true });
  ch.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
  });
}

/**
 * Подписка на очередь: payload парсится из JSON, успешный handler → ack,
 * ошибка handler'а (или битый JSON) → лог + nack(requeue=false).
 * Консьюмер переживает reconnect — регистрация сохраняется.
 *
 * Если брокер недоступен на момент подписки (типично: RabbitMQ ещё стартует),
 * НЕ бросаем — регистрация уже в `consumers`, планируем ретрай через
 * scheduleReconnect (иначе consumer не поднялся бы даже после появления брокера).
 */
export async function consumeQueue(queueName: string, handler: QueueHandler): Promise<void> {
  consumers.set(queueName, handler);
  try {
    const ch = await getChannel();
    await bindConsumer(ch, queueName, handler);
  } catch (err) {
    logger.warn({ err, queue: queueName }, 'rabbitmq: initial subscribe failed — scheduling retry');
    scheduleReconnect();
  }
}

/** Graceful shutdown / тесты. */
export async function closeQueue(): Promise<void> {
  shuttingDown = true;
  consumers.clear();
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch (err) {
    logger.warn({ err }, 'rabbitmq: error during close');
  } finally {
    channel = null;
    connection = null;
    channelPromise = null;
    shuttingDown = false;
    reconnectAttempt = 0;
  }
}
