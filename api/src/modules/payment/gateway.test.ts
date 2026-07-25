import { createHash, createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    WEB_BASE_URL: 'http://localhost:3100',
    CLICK_SECRET_KEY: 'test-click-secret',
    PAYME_SECRET_KEY: 'test-payme-secret',
    // без creds → sim-URL адаптеры
  },
}));

import { AppError } from '../../lib/errors.js';
import { __resetGateways, getGateway } from './gateway.js';

const CLICK_SECRET = 'test-click-secret';
const PAYME_SECRET = 'test-payme-secret';

function clickSign(f: {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string;
  amount: string;
  action: string;
  sign_time: string;
}): string {
  return createHash('md5')
    .update(
      f.click_trans_id + f.service_id + CLICK_SECRET + f.merchant_trans_id + f.amount + f.action + f.sign_time,
    )
    .digest('hex');
}

describe('payment gateways (BE-6.1/6.2)', () => {
  beforeEach(() => __resetGateways());

  describe('createInvoice (dev → sim-URL)', () => {
    it('click → sim-URL с tx/gateway/listingId/amount', async () => {
      const inv = await getGateway('click').createInvoice({
        transactionId: 'pay-1',
        amountUzs: 45000,
        listingId: 'lst-1',
        returnUrl: 'http://localhost:3100/payment/return?tx=pay-1',
      });
      expect(inv.paymentUrl).toContain('/payment/gateway-sim');
      expect(inv.paymentUrl).toContain('tx=pay-1');
      expect(inv.paymentUrl).toContain('gateway=click');
      expect(inv.paymentUrl).toContain('amount=45000');
    });

    it('payme → sim-URL с gateway=payme', async () => {
      const inv = await getGateway('payme').createInvoice({
        transactionId: 'pay-2',
        amountUzs: 45000,
        listingId: 'lst-2',
        returnUrl: 'http://localhost:3100/payment/return?tx=pay-2',
      });
      expect(inv.paymentUrl).toContain('gateway=payme');
    });
  });

  describe('Click parseWebhook (§2.2 md5)', () => {
    const base = {
      click_trans_id: '123456789',
      service_id: 'svc-1',
      merchant_trans_id: 'pay-1',
      amount: '45000',
      action: '1',
      sign_time: '2026-07-23 10:00:00',
    };

    it('валидная подпись + action=1 → success, merchant_trans_id → transactionId', () => {
      const body = { ...base, sign_string: clickSign(base) };
      const ev = getGateway('click').parseWebhook(body);
      expect(ev.outcome).toBe('success');
      expect(ev.transactionId).toBe('pay-1');
      expect(ev.gatewayTransactionId).toBe('123456789');
      expect(ev.amountUzs).toBe(45000);
    });

    it('action=1 + error!=0 → failed', () => {
      const body = { ...base, error: -5, sign_string: clickSign(base) };
      expect(getGateway('click').parseWebhook(body).outcome).toBe('failed');
    });

    it('action=-1 → cancelled', () => {
      const f = { ...base, action: '-1' };
      const body = { ...f, sign_string: clickSign(f) };
      expect(getGateway('click').parseWebhook(body).outcome).toBe('cancelled');
    });

    it('action=0 → prepare', () => {
      const f = { ...base, action: '0' };
      const body = { ...f, sign_string: clickSign(f) };
      expect(getGateway('click').parseWebhook(body).outcome).toBe('prepare');
    });

    it('невалидная подпись → 401 invalid_signature', () => {
      const body = { ...base, sign_string: 'deadbeef' };
      try {
        getGateway('click').parseWebhook(body);
        expect.unreachable();
      } catch (e) {
        expect((e as AppError).status).toBe(401);
        expect((e as AppError).code).toBe('invalid_signature');
      }
    });

    it('отсутствует обязательное поле → 400 bad_webhook', () => {
      expect(() => getGateway('click').parseWebhook({ click_trans_id: '1' })).toThrow(AppError);
    });
  });

  describe('Payme parseWebhook (HMAC-SHA256)', () => {
    const paymeSign = (f: { transaction_id: string; payme_trans_id: string; amount: string; state: string }) =>
      createHmac('sha256', PAYME_SECRET)
        .update(f.transaction_id + f.payme_trans_id + f.amount + f.state)
        .digest('hex');

    it('state=2 + валидная подпись → success', () => {
      const f = { transaction_id: 'pay-9', payme_trans_id: 'pm-1', amount: '45000', state: '2' };
      const ev = getGateway('payme').parseWebhook({ ...f, sign: paymeSign(f) });
      expect(ev.outcome).toBe('success');
      expect(ev.transactionId).toBe('pay-9');
      expect(ev.gatewayTransactionId).toBe('pm-1');
    });

    it('state=-2 → cancelled', () => {
      const f = { transaction_id: 'pay-9', payme_trans_id: 'pm-1', amount: '45000', state: '-2' };
      expect(getGateway('payme').parseWebhook({ ...f, sign: paymeSign(f) }).outcome).toBe('cancelled');
    });

    it('битая подпись → 401', () => {
      const f = { transaction_id: 'pay-9', payme_trans_id: 'pm-1', amount: '45000', state: '2', sign: 'x' };
      expect(() => getGateway('payme').parseWebhook(f)).toThrow(AppError);
    });
  });

  describe('queryStatus (BE-6.5, dev sim → unknown)', () => {
    it('click без creds → unknown (реального шлюза для опроса нет)', async () => {
      const res = await getGateway('click').queryStatus({ transactionId: 'pay-1' });
      expect(res.outcome).toBe('unknown');
    });

    it('payme без merchant_id → unknown', async () => {
      const res = await getGateway('payme').queryStatus({ transactionId: 'pay-1', gatewayTransactionId: 'pm-1' });
      expect(res.outcome).toBe('unknown');
    });
  });
});
