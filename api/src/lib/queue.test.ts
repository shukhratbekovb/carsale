import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsumeMessage } from 'amqplib';

vi.mock('../config/env.js', () => ({
  env: { NODE_ENV: 'test', RABBITMQ_URL: 'amqp://localhost:5672' },
}));

vi.mock('./logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const amqpMocks = vi.hoisted(() => {
  const channel = {
    assertQueue: vi.fn(async () => ({})),
    sendToQueue: vi.fn(() => true),
    consume: vi.fn(async () => ({ consumerTag: 'ctag-1' })),
    ack: vi.fn(),
    nack: vi.fn(),
    close: vi.fn(async () => {}),
  };
  const connection = {
    createChannel: vi.fn(async () => channel),
    on: vi.fn(),
    close: vi.fn(async () => {}),
  };
  const connect = vi.fn(async () => connection);
  return { channel, connection, connect };
});

vi.mock('amqplib', () => ({
  default: { connect: amqpMocks.connect },
  connect: amqpMocks.connect,
}));

import { consumeQueue, publishEvent } from './queue.js';

function fakeMessage(body: string): ConsumeMessage {
  return { content: Buffer.from(body, 'utf8') } as ConsumeMessage;
}

describe('queue wrapper (BE-0.8, at-least-once — 09-architecture §5)', () => {
  beforeEach(() => {
    amqpMocks.channel.assertQueue.mockClear();
    amqpMocks.channel.sendToQueue.mockClear();
    amqpMocks.channel.consume.mockClear();
    amqpMocks.channel.ack.mockClear();
    amqpMocks.channel.nack.mockClear();
  });

  it('publishEvent: durable-очередь, JSON-сериализация, persistent-сообщение', async () => {
    const payload = { listingId: 'l-1', reason: 'fraud_check' };
    await publishEvent('fraud_check', payload);

    expect(amqpMocks.channel.assertQueue).toHaveBeenCalledWith('fraud_check', { durable: true });

    const [queueName, buffer, options] = amqpMocks.channel.sendToQueue.mock.calls[0] as unknown as [
      string,
      Buffer,
      { persistent: boolean; contentType: string },
    ];
    expect(queueName).toBe('fraud_check');
    expect(JSON.parse(buffer.toString('utf8'))).toEqual(payload);
    expect(options.persistent).toBe(true);
    expect(options.contentType).toBe('application/json');
  });

  it('ленивое подключение: одно соединение переиспользуется', async () => {
    await publishEvent('q1', { a: 1 });
    await publishEvent('q2', { b: 2 });
    expect(amqpMocks.connect).toHaveBeenCalledTimes(1);
  });

  it('consumeQueue: успешный handler получает распарсенный JSON и сообщение ack-ается', async () => {
    const handler = vi.fn(async () => {});
    await consumeQueue('notify', handler);

    const [queueName, onMessage] = amqpMocks.channel.consume.mock.calls[0] as unknown as [
      string,
      (msg: ConsumeMessage | null) => Promise<void>,
    ];
    expect(queueName).toBe('notify');

    const msg = fakeMessage(JSON.stringify({ userId: 'u-1' }));
    await onMessage(msg);

    expect(handler).toHaveBeenCalledWith({ userId: 'u-1' }, msg);
    expect(amqpMocks.channel.ack).toHaveBeenCalledWith(msg);
    expect(amqpMocks.channel.nack).not.toHaveBeenCalled();
  });

  it('consumeQueue: ошибка handler-а — nack без requeue, без ack', async () => {
    const handler = vi.fn(async () => {
      throw new Error('boom');
    });
    await consumeQueue('notify-fail', handler);

    const [, onMessage] = amqpMocks.channel.consume.mock.calls[0] as unknown as [
      string,
      (msg: ConsumeMessage | null) => Promise<void>,
    ];

    const msg = fakeMessage(JSON.stringify({ userId: 'u-2' }));
    await onMessage(msg);

    expect(amqpMocks.channel.ack).not.toHaveBeenCalled();
    expect(amqpMocks.channel.nack).toHaveBeenCalledWith(msg, false, false);
  });

  it('consumeQueue: битый JSON — nack без requeue, handler не вызывается', async () => {
    const handler = vi.fn(async () => {});
    await consumeQueue('notify-bad-json', handler);

    const [, onMessage] = amqpMocks.channel.consume.mock.calls[0] as unknown as [
      string,
      (msg: ConsumeMessage | null) => Promise<void>,
    ];

    const msg = fakeMessage('{not-json');
    await onMessage(msg);

    expect(handler).not.toHaveBeenCalled();
    expect(amqpMocks.channel.nack).toHaveBeenCalledWith(msg, false, false);
  });
});
