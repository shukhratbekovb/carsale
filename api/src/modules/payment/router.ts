import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { createPayment, handleWebhook } from './service.js';
import { createPaymentSchema } from './validation.js';

/**
 * Payment Module (BE-6, FR-10, §6.5, ADR-002).
 * - POST /payments/create — авторизованный плательщик создаёт платёж (invoice шлюза)
 * - POST /webhooks/{click,payme} — колбэк шлюза (без auth, но с проверкой подписи),
 *   идемпотентность по gateway_transaction_id, реплей → 200
 */

export const paymentsRouter = Router();

// POST /payments/create — контракт = web/types/payment.ts (CreatedPayment)
paymentsRouter.post(
  '/create',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = createPaymentSchema.parse(req.body);
    const result = await createPayment(getAuth(res).sub, input);
    res.status(201).json(result);
  }),
);

export const webhooksRouter = Router();

// POST /webhooks/click — подпись md5 (§2.2); при валидной подписи всегда 200-ack
webhooksRouter.post(
  '/click',
  asyncHandler(async (req, res) => {
    const result = await handleWebhook('click', req.body);
    res.status(200).json({ error: 0, error_note: 'Success', ...result });
  }),
);

// POST /webhooks/payme — подпись HMAC-SHA256
webhooksRouter.post(
  '/payme',
  asyncHandler(async (req, res) => {
    const result = await handleWebhook('payme', req.body);
    res.status(200).json({ ok: true, ...result });
  }),
);
