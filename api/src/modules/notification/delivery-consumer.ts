import type { NotificationType } from '@prisma/client';
import { logger } from '../../lib/logger.js';
import { consumeQueue } from '../../lib/queue.js';
import { getMailer } from './mailer.js';
import { getPushSender } from './push.js';
import {
  deletePushSubscription,
  getUserEmail,
  listPushSubscriptions,
} from './repository.js';
import { NOTIFICATION_DELIVERY_QUEUE } from './service.js';

/**
 * Consumer внешней доставки уведомлений (BE-7.2/7.3). Разбирает очередь, которую
 * наполняет notify() после персиста in-app: доставляет тем же уведомлением по
 * email (если задан) и Web Push (все подписки). Per-type-гейт уже применён в
 * notify() — сюда попадают только включённые типы. Мёртвые push-подписки
 * (410/404) удаляются. Каналы независимы: сбой одного не блокирует другой.
 */

interface DeliveryEvent {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

function parse(payload: unknown): DeliveryEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p['user_id'] !== 'string' || typeof p['title'] !== 'string') return null;
  return {
    user_id: p['user_id'],
    type: p['type'] as NotificationType,
    title: p['title'],
    message: typeof p['message'] === 'string' ? p['message'] : '',
    ...(typeof p['link'] === 'string' ? { link: p['link'] } : {}),
  };
}

export async function handleDelivery(payload: unknown): Promise<void> {
  const ev = parse(payload);
  if (!ev) {
    logger.warn({ payload }, 'delivery-consumer: bad event, skipping');
    return;
  }

  // Email-канал
  const email = await getUserEmail(ev.user_id);
  if (email) {
    try {
      await getMailer().send({
        to: email,
        subject: ev.title,
        text: ev.message,
        ...(ev.link ? { link: ev.link } : {}),
      });
    } catch (err) {
      logger.warn({ err, userId: ev.user_id }, 'delivery-consumer: email failed');
    }
  }

  // Push-канал (все подписки пользователя)
  const subs = await listPushSubscriptions(ev.user_id);
  const push = getPushSender();
  const pushPayload = { title: ev.title, message: ev.message, ...(ev.link ? { link: ev.link } : {}) };
  for (const s of subs) {
    try {
      const { gone } = await push.send(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        pushPayload,
      );
      if (gone) await deletePushSubscription(s.endpoint);
    } catch (err) {
      logger.warn({ err, userId: ev.user_id }, 'delivery-consumer: push failed');
    }
  }

  logger.info(
    { userId: ev.user_id, type: ev.type, email: Boolean(email), pushCount: subs.length },
    'delivery-consumer: delivered',
  );
}

export async function startDeliveryConsumer(): Promise<void> {
  await consumeQueue(NOTIFICATION_DELIVERY_QUEUE, (payload) => handleDelivery(payload));
  logger.info({ queue: NOTIFICATION_DELIVERY_QUEUE }, 'delivery-consumer: subscribed');
}
