import webpush from 'web-push';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

/**
 * Порт Web Push доставки (BE-7.3, I-5, VAPID). Реализации: WebPushSender
 * (библиотека web-push) и MockPushSender (dev/тесты). Фабрика — по наличию
 * VAPID-ключей. `gone=true` означает, что подписка мертва (410/404) — вызывающий
 * должен удалить её из БД.
 */
export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  message: string;
  link?: string;
}

export interface PushSender {
  send(sub: PushSubscriptionData, payload: PushPayload): Promise<{ gone: boolean }>;
}

export class WebPushSender implements PushSender {
  constructor() {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  }

  async send(sub: PushSubscriptionData, payload: PushPayload): Promise<{ gone: boolean }> {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload),
      );
      return { gone: false };
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410 — подписка отозвана/просрочена → пометить на удаление
      if (status === 404 || status === 410) return { gone: true };
      logger.warn({ err, status }, 'web-push: send failed');
      return { gone: false };
    }
  }
}

/** Dev/тесты: логирует «отправку», ничего не шлёт. */
export class MockPushSender implements PushSender {
  async send(sub: PushSubscriptionData): Promise<{ gone: boolean }> {
    logger.info({ endpoint: sub.endpoint.slice(0, 32) }, 'mock-push: push "sent"');
    return Promise.resolve({ gone: false });
  }
}

let sender: PushSender | null = null;

export function getPushSender(): PushSender {
  if (!sender) {
    if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
      logger.info('push: using WebPush (VAPID)');
      sender = new WebPushSender();
    } else {
      logger.info('push: VAPID keys unset — using MockPushSender (dev)');
      sender = new MockPushSender();
    }
  }
  return sender;
}

export function __resetPushSender(): void {
  sender = null;
}
