import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { PaymentGateway } from '@prisma/client';

/**
 * Порт платёжного шлюза (BE-6.1/6.2, ADR-002). Один интерфейс — два адаптера
 * (Click / Payme), решение «оба шлюза с первого дня» (HANDOFF, 2026-07-05).
 * Контракт Click — docs/analysis/10-integrations-api.md §2.2 (create invoice +
 * webhook с md5-подписью). Payme — тот же порт (реальный Merchant API — JSON-RPC,
 * здесь упрощённый webhook с HMAC-подписью; протокол абстрагирован портом,
 * заменяется без правки service/router).
 *
 * `merchant_trans_id` во внешнем контракте = наш `Payment.id` (передаётся как
 * transactionId). `gatewayTransactionId` (click_trans_id / payme id) — ключ
 * идемпотентности webhook (UNIQUE на Payment).
 */

export type WebhookOutcome = 'success' | 'failed' | 'cancelled' | 'prepare';

export interface CreateInvoiceParams {
  /** merchant_trans_id — наш Payment.id */
  transactionId: string;
  amountUzs: number;
  listingId: string;
  /** куда шлюз вернёт пользователя после оплаты */
  returnUrl: string;
}

export interface CreatedInvoice {
  paymentUrl: string;
}

export interface WebhookEvent {
  /** merchant_trans_id → наш Payment.id */
  transactionId: string;
  /** внешний id транзакции шлюза — ключ идемпотентности */
  gatewayTransactionId: string;
  amountUzs: number;
  outcome: WebhookOutcome;
}

/** Результат опроса статуса (BE-6.5). `unknown` — шлюз не знает/недоступен
 *  (в т.ч. dev sim-режим без реального шлюза) → реконсиляция платёж не трогает. */
export type StatusOutcome = WebhookOutcome | 'unknown';

export interface StatusQuery {
  /** merchant_trans_id — наш Payment.id */
  transactionId: string;
  /** внешний id, если уже известен (был prepare-webhook) */
  gatewayTransactionId?: string | null;
}

export interface StatusResult {
  outcome: StatusOutcome;
  /** внешний id транзакции, если шлюз его вернул (для фиксации идемпотентности) */
  gatewayTransactionId?: string;
}

export interface PaymentGatewayPort {
  readonly name: Lowercase<PaymentGateway>;
  createInvoice(params: CreateInvoiceParams): Promise<CreatedInvoice>;
  /** Валидирует подпись и парсит тело webhook; невалидная подпись → 401 invalid_signature. */
  parseWebhook(body: unknown): WebhookEvent;
  /**
   * Опрос текущего статуса платежа у шлюза (polling-fallback BE-6.5): вызывается
   * реконсиляцией, когда webhook не пришёл за N минут. В dev sim-режиме реального
   * шлюза нет → `unknown` (реконсиляция ничего не меняет).
   */
  queryStatus(query: StatusQuery): Promise<StatusResult>;
}

const REQUEST_TIMEOUT_MS = 5_000;

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'bad_webhook', 'Webhook body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

function str(rec: Record<string, unknown>, key: string): string {
  const v = rec[key];
  if (v === undefined || v === null) {
    throw new AppError(400, 'bad_webhook', `Webhook field '${key}' is required`);
  }
  return String(v);
}

/** Постоянное по времени сравнение подписей (защита от timing-атак). */
function signatureMatches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─────────────────────────────── Click (§2.2) ───────────────────────────────

export interface ClickConfig {
  secretKey: string;
  webBaseUrl: string;
  serviceId?: string;
  token?: string;
  merchantApiUrl?: string;
}

export class ClickGateway implements PaymentGatewayPort {
  readonly name = 'click' as const;
  constructor(private readonly cfg: ClickConfig) {}

  async createInvoice(params: CreateInvoiceParams): Promise<CreatedInvoice> {
    // Реальный Click (задан service_id + merchant API) — POST invoice/create.
    // Без креденшелов (dev) — внутренняя страница-имитация шлюза (та же, что у
    // фронтового мока: web/lib/mock/payment.ts), чтобы флоу воспроизводился живьём.
    if (this.cfg.serviceId && this.cfg.token && this.cfg.merchantApiUrl) {
      return this.createRealInvoice(params);
    }
    const paymentUrl = `${this.cfg.webBaseUrl}/payment/gateway-sim?${new URLSearchParams({
      tx: params.transactionId,
      gateway: 'click',
      listingId: params.listingId,
      amount: String(params.amountUzs),
    }).toString()}`;
    return { paymentUrl };
  }

  private async createRealInvoice(params: CreateInvoiceParams): Promise<CreatedInvoice> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.cfg.merchantApiUrl}/v2/merchant/invoice/create`, {
        method: 'POST',
        headers: { Authorization: this.cfg.token!, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: this.cfg.serviceId,
          amount: params.amountUzs,
          currency: 'UZS',
          transaction_id: params.transactionId,
          description: `Carsale listing #${params.listingId}`,
          return_url: params.returnUrl,
          expire_time: 1800,
        }),
        signal: controller.signal,
      });
      const data = (await res.json()) as { error?: number; payment_url?: string };
      if (!res.ok || data.error !== 0 || !data.payment_url) {
        throw new Error(`click invoice/create failed: ${res.status} error=${data.error ?? '?'}`);
      }
      return { paymentUrl: data.payment_url };
    } catch (err) {
      logger.error({ err }, 'click: invoice/create failed');
      throw new AppError(503, 'gateway_unavailable', 'Payment gateway is temporarily unavailable');
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Webhook Click (§2.2): sign_string = md5(click_trans_id + service_id +
   * SECRET_KEY + merchant_trans_id + amount + action + sign_time).
   * action: 1 оплата (error==0 → success, иначе failed), -1 отмена, 0 prepare.
   */
  parseWebhook(body: unknown): WebhookEvent {
    const rec = asRecord(body);
    const clickTransId = str(rec, 'click_trans_id');
    const serviceId = str(rec, 'service_id');
    const merchantTransId = str(rec, 'merchant_trans_id');
    const amount = str(rec, 'amount');
    const action = str(rec, 'action');
    const signTime = str(rec, 'sign_time');
    const signString = str(rec, 'sign_string');

    const expected = createHash('md5')
      .update(clickTransId + serviceId + this.cfg.secretKey + merchantTransId + amount + action + signTime)
      .digest('hex');
    if (!signatureMatches(expected, signString)) {
      throw new AppError(401, 'invalid_signature', 'Webhook signature verification failed');
    }

    const errorCode = rec['error'] !== undefined ? Number(rec['error']) : 0;
    let outcome: WebhookOutcome;
    if (action === '1') outcome = errorCode === 0 ? 'success' : 'failed';
    else if (action === '-1') outcome = 'cancelled';
    else if (action === '0') outcome = 'prepare';
    else throw new AppError(400, 'bad_webhook', `Unknown Click action '${action}'`);

    return {
      transactionId: merchantTransId,
      gatewayTransactionId: clickTransId,
      amountUzs: Number(amount),
      outcome,
    };
  }

  /** Опрос статуса (BE-6.5): реальный Click — payment/status по merchant_trans_id;
   *  dev sim (без креденшелов) — `unknown` (реального шлюза для опроса нет). */
  async queryStatus(query: StatusQuery): Promise<StatusResult> {
    if (!this.cfg.serviceId || !this.cfg.token || !this.cfg.merchantApiUrl) {
      return { outcome: 'unknown' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(
        `${this.cfg.merchantApiUrl}/v2/merchant/payment/status?service_id=${this.cfg.serviceId}&merchant_trans_id=${query.transactionId}`,
        { headers: { Authorization: this.cfg.token }, signal: controller.signal },
      );
      const data = (await res.json()) as { payment_status?: number; click_trans_id?: string | number };
      if (!res.ok) throw new Error(`click payment/status failed: ${res.status}`);
      // Click payment_status: 2 — оплачено; -1/-2/... — отменено/ошибка; иначе ещё в процессе
      const gatewayTransactionId =
        data.click_trans_id !== undefined ? String(data.click_trans_id) : undefined;
      if (data.payment_status === 2) return { outcome: 'success', ...(gatewayTransactionId ? { gatewayTransactionId } : {}) };
      if (typeof data.payment_status === 'number' && data.payment_status < 0) {
        return { outcome: 'cancelled', ...(gatewayTransactionId ? { gatewayTransactionId } : {}) };
      }
      return { outcome: 'unknown' };
    } catch (err) {
      logger.warn({ err, transactionId: query.transactionId }, 'click: payment/status query failed');
      return { outcome: 'unknown' };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─────────────────────────────── Payme ──────────────────────────────────────

export interface PaymeConfig {
  secretKey: string;
  webBaseUrl: string;
  merchantId?: string;
}

export class PaymeGateway implements PaymentGatewayPort {
  readonly name = 'payme' as const;
  constructor(private readonly cfg: PaymeConfig) {}

  async createInvoice(params: CreateInvoiceParams): Promise<CreatedInvoice> {
    // Реальный Payme checkout — base64-энкод параметров в путь (сумма в тийинах ×100).
    // Без merchant_id (dev) — та же внутренняя страница-имитация, что у Click.
    if (this.cfg.merchantId) {
      const encoded = Buffer.from(
        `m=${this.cfg.merchantId};ac.listing_id=${params.listingId};a=${params.amountUzs * 100};c=${params.returnUrl}`,
        'utf8',
      ).toString('base64');
      return { paymentUrl: `https://checkout.payme.uz/${encoded}` };
    }
    const paymentUrl = `${this.cfg.webBaseUrl}/payment/gateway-sim?${new URLSearchParams({
      tx: params.transactionId,
      gateway: 'payme',
      listingId: params.listingId,
      amount: String(params.amountUzs),
    }).toString()}`;
    return { paymentUrl };
  }

  /**
   * Webhook Payme (упрощённый — реальный Merchant API — JSON-RPC
   * CheckPerformTransaction/CreateTransaction/PerformTransaction). Подпись —
   * HMAC-SHA256(transaction_id + payme_trans_id + amount + state, SECRET).
   * state: 2 проведён (success), 1 создан (prepare), -1/-2 отменён (cancelled).
   */
  parseWebhook(body: unknown): WebhookEvent {
    const rec = asRecord(body);
    const transactionId = str(rec, 'transaction_id');
    const paymeTransId = str(rec, 'payme_trans_id');
    const amount = str(rec, 'amount');
    const state = str(rec, 'state');
    const sign = str(rec, 'sign');

    const expected = createHmac('sha256', this.cfg.secretKey)
      .update(transactionId + paymeTransId + amount + state)
      .digest('hex');
    if (!signatureMatches(expected, sign)) {
      throw new AppError(401, 'invalid_signature', 'Webhook signature verification failed');
    }

    let outcome: WebhookOutcome;
    if (state === '2') outcome = 'success';
    else if (state === '1') outcome = 'prepare';
    else if (state === '-1' || state === '-2') outcome = 'cancelled';
    else throw new AppError(400, 'bad_webhook', `Unknown Payme state '${state}'`);

    return {
      transactionId,
      gatewayTransactionId: paymeTransId,
      amountUzs: Number(amount),
      outcome,
    };
  }

  /** Опрос статуса (BE-6.5): реальный Payme — JSON-RPC CheckTransaction; dev sim
   *  (без merchant_id) — `unknown`. Реальный Payme опрашивают по payme_trans_id,
   *  которого до первого webhook нет → без него тоже `unknown`. */
  async queryStatus(query: StatusQuery): Promise<StatusResult> {
    if (!this.cfg.merchantId || !query.gatewayTransactionId) {
      return { outcome: 'unknown' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch('https://checkout.payme.uz/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Auth': this.cfg.secretKey },
        body: JSON.stringify({
          method: 'CheckTransaction',
          params: { id: query.gatewayTransactionId },
        }),
        signal: controller.signal,
      });
      const data = (await res.json()) as { result?: { state?: number } };
      if (!res.ok) throw new Error(`payme CheckTransaction failed: ${res.status}`);
      const state = data.result?.state;
      // Payme state: 2 — проведён; -1/-2 — отменён; 1 — создан (ещё в процессе)
      if (state === 2) return { outcome: 'success', gatewayTransactionId: query.gatewayTransactionId };
      if (state === -1 || state === -2) {
        return { outcome: 'cancelled', gatewayTransactionId: query.gatewayTransactionId };
      }
      return { outcome: 'unknown' };
    } catch (err) {
      logger.warn({ err, transactionId: query.transactionId }, 'payme: CheckTransaction query failed');
      return { outcome: 'unknown' };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─────────────────────────────── Factory ────────────────────────────────────

let gateways: Record<Lowercase<PaymentGateway>, PaymentGatewayPort> | null = null;

/** Ленивая фабрика адаптеров (dev → sim-URL, prod → реальные при заданных креденшелах). */
export function getGateway(name: Lowercase<PaymentGateway>): PaymentGatewayPort {
  if (!gateways) {
    const webBaseUrl = env.WEB_BASE_URL;
    gateways = {
      click: new ClickGateway({
        secretKey: env.CLICK_SECRET_KEY,
        webBaseUrl,
        ...(env.CLICK_SERVICE_ID ? { serviceId: env.CLICK_SERVICE_ID } : {}),
        ...(env.CLICK_TOKEN ? { token: env.CLICK_TOKEN } : {}),
        ...(env.CLICK_MERCHANT_API_URL ? { merchantApiUrl: env.CLICK_MERCHANT_API_URL } : {}),
      }),
      payme: new PaymeGateway({
        secretKey: env.PAYME_SECRET_KEY,
        webBaseUrl,
        ...(env.PAYME_MERCHANT_ID ? { merchantId: env.PAYME_MERCHANT_ID } : {}),
      }),
    };
    if (!env.CLICK_SERVICE_ID && !env.PAYME_MERCHANT_ID) {
      logger.info('payment: no gateway credentials set — using sim-URL adapters (dev)');
    }
  }
  return gateways[name];
}

/** Сброс кэша фабрики (для тестов). */
export function __resetGateways(): void {
  gateways = null;
}
