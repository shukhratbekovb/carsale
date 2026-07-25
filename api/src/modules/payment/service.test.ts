import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({
  env: { NODE_ENV: 'test', WEB_BASE_URL: 'http://localhost:3100', PAYMENT_POLL_STALE_MS: 300000 },
}));

const repo = vi.hoisted(() => ({
  createPayment: vi.fn(),
  findPayment: vi.fn(),
  setPaymentStatus: vi.fn(),
  findListingForPayment: vi.fn(),
  findStaleProcessingPayments: vi.fn(),
}));
vi.mock('./repository.js', () => repo);

const gw = vi.hoisted(() => ({ createInvoice: vi.fn(), parseWebhook: vi.fn(), queryStatus: vi.fn() }));
vi.mock('./gateway.js', () => ({ getGateway: () => gw }));

const notif = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('../notification/service.js', () => notif);

import { AppError } from '../../lib/errors.js';
import { createPayment, handleWebhook, reconcileStalePaymentsJob } from './service.js';

const decimal = (n: number) => ({ toNumber: () => n }) as unknown as Prisma.Decimal;

describe('payment service (BE-6.3/6.4/6.6)', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createPayment', () => {
    const validInput = {
      listingId: '11111111-1111-1111-1111-111111111111',
      amountUzs: 45000,
      gateway: 'click' as const,
      paymentType: 'VEHICLE_REPORT' as const,
    };

    it('сумма ≠ серверному прайсу → 400 amount_mismatch', async () => {
      await expect(createPayment('u1', { ...validInput, amountUzs: 1 })).rejects.toMatchObject({
        status: 400,
        code: 'amount_mismatch',
      });
      expect(repo.createPayment).not.toHaveBeenCalled();
    });

    it('LISTING_PUBLICATION (бесплатна в MVP) → 400 payment_type_unsupported', async () => {
      await expect(
        createPayment('u1', { ...validInput, paymentType: 'LISTING_PUBLICATION', amountUzs: 45000 }),
      ).rejects.toMatchObject({ code: 'payment_type_unsupported' });
    });

    it('листинга нет → 404 listing_not_found', async () => {
      repo.findListingForPayment.mockResolvedValue(null);
      await expect(createPayment('u1', validInput)).rejects.toMatchObject({ code: 'listing_not_found' });
    });

    it('happy: создаёт Payment, зовёт invoice, ставит PROCESSING, возвращает {transactionId, paymentUrl}', async () => {
      repo.findListingForPayment.mockResolvedValue({ id: validInput.listingId, sellerId: 's1', status: 'PUBLISHED' });
      repo.createPayment.mockResolvedValue({ id: 'pay-1', gateway: 'CLICK' });
      gw.createInvoice.mockResolvedValue({ paymentUrl: '/payment/gateway-sim?tx=pay-1' });

      const res = await createPayment('u1', validInput);
      expect(res).toEqual({ transactionId: 'pay-1', paymentUrl: '/payment/gateway-sim?tx=pay-1' });
      expect(repo.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', gateway: 'CLICK', amountUzs: 45000, paymentType: 'VEHICLE_REPORT' }),
      );
      expect(gw.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ transactionId: 'pay-1', returnUrl: 'http://localhost:3100/payment/return?tx=pay-1' }),
      );
      expect(repo.setPaymentStatus).toHaveBeenCalledWith('pay-1', 'PROCESSING');
    });
  });

  describe('handleWebhook', () => {
    it('success → SUCCESS + квитанция через notify', async () => {
      gw.parseWebhook.mockReturnValue({ transactionId: 'pay-1', gatewayTransactionId: 'g-1', amountUzs: 45000, outcome: 'success' });
      repo.findPayment.mockResolvedValue({ id: 'pay-1', userId: 'u1', listingId: 'lst-1', status: 'PROCESSING', amountUzs: decimal(45000) });

      const res = await handleWebhook('click', {});
      expect(res).toEqual({ status: 'SUCCESS', idempotent: false });
      expect(repo.setPaymentStatus).toHaveBeenCalledWith('pay-1', 'SUCCESS', 'g-1');
      expect(notif.notify).toHaveBeenCalledWith('u1', 'LISTING_STATUS', expect.objectContaining({ title: 'Оплата получена' }));
    });

    it('прошлый терминальный статус → идемпотентный 200 no-op (не трогаем статус)', async () => {
      gw.parseWebhook.mockReturnValue({ transactionId: 'pay-1', gatewayTransactionId: 'g-1', amountUzs: 45000, outcome: 'success' });
      repo.findPayment.mockResolvedValue({ id: 'pay-1', userId: 'u1', listingId: 'lst-1', status: 'SUCCESS', amountUzs: decimal(45000) });

      const res = await handleWebhook('click', {});
      expect(res).toEqual({ status: 'SUCCESS', idempotent: true });
      expect(repo.setPaymentStatus).not.toHaveBeenCalled();
      expect(notif.notify).not.toHaveBeenCalled();
    });

    it('failed → FAILED, без квитанции', async () => {
      gw.parseWebhook.mockReturnValue({ transactionId: 'pay-1', gatewayTransactionId: 'g-1', amountUzs: 45000, outcome: 'failed' });
      repo.findPayment.mockResolvedValue({ id: 'pay-1', userId: 'u1', listingId: 'lst-1', status: 'PROCESSING', amountUzs: decimal(45000) });

      const res = await handleWebhook('click', {});
      expect(res.status).toBe('FAILED');
      expect(notif.notify).not.toHaveBeenCalled();
    });

    it('prepare → no-op ack, статус не меняется', async () => {
      gw.parseWebhook.mockReturnValue({ transactionId: 'pay-1', gatewayTransactionId: 'g-1', amountUzs: 45000, outcome: 'prepare' });
      repo.findPayment.mockResolvedValue({ id: 'pay-1', status: 'PROCESSING' });

      const res = await handleWebhook('click', {});
      expect(res.idempotent).toBe(true);
      expect(repo.setPaymentStatus).not.toHaveBeenCalled();
    });

    it('неизвестный платёж → 404 payment_not_found', async () => {
      gw.parseWebhook.mockReturnValue({ transactionId: 'nope', gatewayTransactionId: 'g-1', amountUzs: 1, outcome: 'success' });
      repo.findPayment.mockResolvedValue(null);
      await expect(handleWebhook('click', {})).rejects.toMatchObject({ status: 404, code: 'payment_not_found' });
    });

    it('P2002 на gateway_transaction_id → идемпотентный реплей', async () => {
      gw.parseWebhook.mockReturnValue({ transactionId: 'pay-1', gatewayTransactionId: 'g-dup', amountUzs: 45000, outcome: 'success' });
      repo.findPayment.mockResolvedValue({ id: 'pay-1', userId: 'u1', listingId: 'lst-1', status: 'PROCESSING', amountUzs: decimal(45000) });
      repo.setPaymentStatus.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' }),
      );
      const res = await handleWebhook('click', {});
      expect(res.idempotent).toBe(true);
      expect(notif.notify).not.toHaveBeenCalled();
    });

    it('невалидная подпись из gateway пробрасывается (401)', async () => {
      gw.parseWebhook.mockImplementation(() => {
        throw new AppError(401, 'invalid_signature', 'bad');
      });
      await expect(handleWebhook('click', {})).rejects.toMatchObject({ status: 401, code: 'invalid_signature' });
    });
  });

  describe('reconcileStalePaymentsJob (BE-6.5)', () => {
    // clearAllMocks не сбрасывает implementations — снимаем возможный
    // mockRejectedValue от webhook-теста P2002, чтобы settle резолвился
    beforeEach(() => repo.setPaymentStatus.mockReset());

    const stalePayment = (over: Record<string, unknown> = {}) => ({
      id: 'pay-1',
      userId: 'u1',
      listingId: 'lst-1',
      status: 'PROCESSING',
      gateway: 'CLICK',
      gatewayTransactionId: null,
      amountUzs: decimal(45000),
      ...over,
    });

    it('нет зависших → шлюз не опрашивается', async () => {
      repo.findStaleProcessingPayments.mockResolvedValue([]);
      await reconcileStalePaymentsJob();
      expect(gw.queryStatus).not.toHaveBeenCalled();
    });

    it('шлюз вернул success → SUCCESS + квитанция (то же ядро, что webhook)', async () => {
      repo.findStaleProcessingPayments.mockResolvedValue([stalePayment()]);
      gw.queryStatus.mockResolvedValue({ outcome: 'success', gatewayTransactionId: 'g-99' });
      await reconcileStalePaymentsJob();
      expect(gw.queryStatus).toHaveBeenCalledWith({ transactionId: 'pay-1', gatewayTransactionId: null });
      expect(repo.setPaymentStatus).toHaveBeenCalledWith('pay-1', 'SUCCESS', 'g-99');
      expect(notif.notify).toHaveBeenCalledWith('u1', 'LISTING_STATUS', expect.objectContaining({ title: 'Оплата получена' }));
    });

    it('шлюз не знает (unknown) → платёж не трогаем', async () => {
      repo.findStaleProcessingPayments.mockResolvedValue([stalePayment()]);
      gw.queryStatus.mockResolvedValue({ outcome: 'unknown' });
      await reconcileStalePaymentsJob();
      expect(repo.setPaymentStatus).not.toHaveBeenCalled();
      expect(notif.notify).not.toHaveBeenCalled();
    });

    it('без свежего gatewayTransactionId в ответе — берём известный из платежа', async () => {
      repo.findStaleProcessingPayments.mockResolvedValue([stalePayment({ gatewayTransactionId: 'g-known' })]);
      gw.queryStatus.mockResolvedValue({ outcome: 'cancelled' });
      await reconcileStalePaymentsJob();
      expect(repo.setPaymentStatus).toHaveBeenCalledWith('pay-1', 'CANCELLED', 'g-known');
    });

    it('сбой опроса одного платежа не роняет обработку остальных', async () => {
      repo.findStaleProcessingPayments.mockResolvedValue([
        stalePayment({ id: 'pay-1' }),
        stalePayment({ id: 'pay-2' }),
      ]);
      gw.queryStatus
        .mockRejectedValueOnce(new Error('gateway down'))
        .mockResolvedValueOnce({ outcome: 'success', gatewayTransactionId: 'g-2' });
      await reconcileStalePaymentsJob();
      expect(repo.setPaymentStatus).toHaveBeenCalledTimes(1);
      expect(repo.setPaymentStatus).toHaveBeenCalledWith('pay-2', 'SUCCESS', 'g-2');
    });
  });
});
