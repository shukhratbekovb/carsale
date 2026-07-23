import type { PaymentGateway, PaymentStatus, PaymentType, Prisma } from '@prisma/client';
import { getPrisma } from '../../lib/prisma.js';

/** Доступ к платежам (BE-6). Payment.id = merchant_trans_id во внешнем контракте. */

export const paymentSelect = {
  id: true,
  listingId: true,
  userId: true,
  paymentType: true,
  amountUzs: true,
  status: true,
  gateway: true,
  gatewayTransactionId: true,
} satisfies Prisma.PaymentSelect;

export type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

export interface CreatePaymentData {
  listingId: string;
  userId: string;
  paymentType: PaymentType;
  amountUzs: number;
  gateway: PaymentGateway;
}

export async function createPayment(data: CreatePaymentData): Promise<PaymentRow> {
  return getPrisma().payment.create({
    data: {
      listingId: data.listingId,
      userId: data.userId,
      paymentType: data.paymentType,
      amountUzs: data.amountUzs,
      gateway: data.gateway,
      status: 'PENDING',
    },
    select: paymentSelect,
  });
}

export async function findPayment(id: string): Promise<PaymentRow | null> {
  return getPrisma().payment.findUnique({ where: { id }, select: paymentSelect });
}

/**
 * Смена статуса + (опционально) фиксация gateway_transaction_id.
 * UNIQUE на gateway_transaction_id — вторая транзакция шлюза с тем же id
 * не сможет записаться в другой платёж (защита идемпотентности на уровне БД).
 */
export async function setPaymentStatus(
  id: string,
  status: PaymentStatus,
  gatewayTransactionId?: string,
): Promise<void> {
  await getPrisma().payment.update({
    where: { id },
    data: {
      status,
      ...(gatewayTransactionId ? { gatewayTransactionId } : {}),
    },
  });
}

export interface ListingForPayment {
  id: string;
  sellerId: string;
  status: string;
}

/** Листинг, за который платят (проверка существования при create). */
export async function findListingForPayment(id: string): Promise<ListingForPayment | null> {
  return getPrisma().listing.findUnique({
    where: { id },
    select: { id: true, sellerId: true, status: true },
  });
}
