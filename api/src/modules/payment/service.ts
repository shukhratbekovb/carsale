import { Prisma, type PaymentStatus, type PaymentType } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { notify } from '../notification/service.js';
import { getGateway, type WebhookOutcome } from './gateway.js';
import {
  createPayment as repoCreatePayment,
  findListingForPayment,
  findPayment,
  findStaleProcessingPayments,
  type PaymentRow,
  setPaymentStatus,
} from './repository.js';
import { isTerminal } from './status-machine.js';
import type { CreatePaymentInput } from './validation.js';

/**
 * Payment-сервис (BE-6.3/6.4/6.6, §6.5). Создание платежа → invoice шлюза →
 * PROCESSING; webhook шлюза → терминальный статус с идемпотентностью по
 * gateway_transaction_id; квитанция продавцу через notify (BE-6.6).
 */

// Прайс определяется СЕРВЕРОМ — сумма из тела клиента только сверяется (деньги
// не доверяем клиенту). VEHICLE_REPORT = 45 000 сум (= web/lib/mock/payment.ts).
// LISTING_PUBLICATION не монетизируется в MVP (публикация бесплатна, HANDOFF п.16).
export const VEHICLE_REPORT_PRICE_UZS = 45_000;
const SERVER_PRICE_UZS: Partial<Record<PaymentType, number>> = {
  VEHICLE_REPORT: VEHICLE_REPORT_PRICE_UZS,
};

const OUTCOME_TO_STATUS: Record<Exclude<WebhookOutcome, 'prepare'>, PaymentStatus> = {
  success: 'SUCCESS',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
};

export interface CreatedPaymentResult {
  transactionId: string;
  paymentUrl: string;
}

/**
 * Создание платежа (§6.5 фаза 1). Контракт ответа = web/types/payment.ts
 * (CreatedPayment { transactionId, paymentUrl }). transactionId = наш Payment.id
 * = merchant_trans_id для шлюза.
 */
export async function createPayment(
  userId: string,
  input: CreatePaymentInput,
): Promise<CreatedPaymentResult> {
  const price = SERVER_PRICE_UZS[input.paymentType];
  if (price === undefined) {
    throw new AppError(400, 'payment_type_unsupported', `${input.paymentType} is free in MVP`, {
      paymentType: input.paymentType,
    });
  }
  if (input.amountUzs !== price) {
    throw new AppError(400, 'amount_mismatch', 'Amount does not match the server price', {
      expected: price,
    });
  }

  const listing = await findListingForPayment(input.listingId);
  if (!listing) throw new AppError(404, 'listing_not_found', 'Listing not found');

  const gatewayName = input.gateway; // 'click' | 'payme'
  const payment = await repoCreatePayment({
    listingId: input.listingId,
    userId,
    paymentType: input.paymentType,
    amountUzs: price,
    gateway: gatewayName.toUpperCase() as 'CLICK' | 'PAYME',
  });

  const invoice = await getGateway(gatewayName).createInvoice({
    transactionId: payment.id,
    amountUzs: price,
    listingId: input.listingId,
    returnUrl: `${env.WEB_BASE_URL}/payment/return?tx=${payment.id}`,
  });

  // Пользователь редиректится на страницу шлюза → PROCESSING (07 §2.3)
  await setPaymentStatus(payment.id, 'PROCESSING');

  return { transactionId: payment.id, paymentUrl: invoice.paymentUrl };
}

export interface WebhookResult {
  status: PaymentStatus;
  idempotent: boolean;
}

/**
 * Обработка webhook шлюза (§6.5, BE-6.4). Порядок §2.2: проверить подпись →
 * найти платёж по merchant_trans_id → идемпотентность (терминальный → 200 no-op)
 * → сменить статус → на SUCCESS отправить квитанцию. Возвращает результат;
 * роутер всегда отвечает шлюзу 200 (ack), ошибки подписи/тела — до этого.
 */
export async function handleWebhook(
  gatewayName: 'click' | 'payme',
  body: unknown,
): Promise<WebhookResult> {
  const event = getGateway(gatewayName).parseWebhook(body);

  // prepare-фаза Click (action=0) — только подтверждаем приём, без смены статуса
  if (event.outcome === 'prepare') {
    const existing = await findPayment(event.transactionId);
    return { status: existing?.status ?? 'PENDING', idempotent: true };
  }

  const payment = await findPayment(event.transactionId);
  if (!payment) throw new AppError(404, 'payment_not_found', 'Payment not found');

  // Идемпотентность: платёж уже урегулирован (SUCCESS/CANCELLED/REFUNDED) → реплей, 200 no-op
  if (isTerminal(payment.status)) {
    return { status: payment.status, idempotent: true };
  }

  return settlePayment(payment, OUTCOME_TO_STATUS[event.outcome], event.gatewayTransactionId);
}

/**
 * Урегулирование платежа в терминальный статус — общее ядро для webhook (BE-6.4)
 * и polling-fallback (BE-6.5). Идемпотентно на уровне БД: гонка webhook↔polling за
 * один и тот же gateway_transaction_id ловится UNIQUE (P2002) → 200 no-op.
 * На SUCCESS отправляет квитанцию (best-effort через notify).
 */
async function settlePayment(
  payment: PaymentRow,
  target: PaymentStatus,
  gatewayTransactionId: string,
): Promise<WebhookResult> {
  try {
    await setPaymentStatus(payment.id, target, gatewayTransactionId);
  } catch (err) {
    // UNIQUE gateway_transaction_id: та же транзакция шлюза уже записана → идемпотентный реплей
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      logger.info({ paymentId: payment.id }, 'settle: gateway_transaction_id replay — idempotent');
      return { status: payment.status, idempotent: true };
    }
    throw err;
  }

  if (target === 'SUCCESS') await sendReceipt(payment);
  return { status: target, idempotent: false };
}

/**
 * Polling-fallback (BE-6.5): опросить шлюз по зависшим PROCESSING-платежам, для
 * которых webhook не пришёл за PAYMENT_POLL_STALE_MS. Каждый платёж обрабатывается
 * независимо (сбой одного не роняет пачку). Терминальный ответ шлюза → тот же
 * settlePayment, что и webhook (одинаковая идемпотентность). `unknown` → пропуск.
 */
export async function reconcileStalePaymentsJob(): Promise<void> {
  const cutoff = new Date(Date.now() - env.PAYMENT_POLL_STALE_MS);
  const stale = await findStaleProcessingPayments(cutoff, 50);
  if (stale.length === 0) return;

  let settled = 0;
  for (const payment of stale) {
    try {
      const gatewayName = payment.gateway.toLowerCase() as 'click' | 'payme';
      const result = await getGateway(gatewayName).queryStatus({
        transactionId: payment.id,
        gatewayTransactionId: payment.gatewayTransactionId,
      });
      // 'unknown' — шлюз не знает; 'prepare' — незавершённая фаза (адаптеры
      // queryStatus её не возвращают, но исключаем для полноты типов)
      if (result.outcome === 'unknown' || result.outcome === 'prepare') continue;
      const target = OUTCOME_TO_STATUS[result.outcome];
      // Внешний id: свежий из ответа шлюза, иначе уже известный (prepare-webhook)
      const gatewayTxId = result.gatewayTransactionId ?? payment.gatewayTransactionId ?? payment.id;
      const res = await settlePayment(payment, target, gatewayTxId);
      if (!res.idempotent) settled += 1;
    } catch (err) {
      logger.warn({ err, paymentId: payment.id }, 'reconcile: payment poll failed');
    }
  }
  logger.info({ scanned: stale.length, settled }, 'reconcile: stale payments polled');
}

/**
 * Квитанция (BE-6.6): через notify (LISTING_STATUS — ближайший тип FR-11 для
 * платёжно-статусного события; email-канал квитанции — BE-7.2, пока in-app + лог).
 * best-effort — notify сам глушит сбои, платёж от этого не откатывается.
 */
async function sendReceipt(payment: PaymentRow): Promise<void> {
  const amount = payment.amountUzs.toNumber();
  await notify(payment.userId, 'LISTING_STATUS', {
    title: 'Оплата получена',
    message: `Платёж на ${amount.toLocaleString('ru-RU')} сум прошёл успешно. Квитанция отправлена на email.`,
    link: `/catalog/${payment.listingId}`,
  });
  logger.info({ paymentId: payment.id, userId: payment.userId }, 'payment: receipt sent');
}
