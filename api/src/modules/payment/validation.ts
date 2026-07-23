import { z } from 'zod';

/**
 * Тело POST /payments/create — контракт = web/types/payment.ts (PaymentOrder):
 * { listingId, amountUzs, gateway }. `paymentType` опционален (аддитивно к
 * фронтовому контракту) и по умолчанию VEHICLE_REPORT — именно эту ветку
 * демонстрирует фронт (публикация в MVP бесплатна, HANDOFF п.16).
 * Сумма из тела сверяется с серверным прайсом в сервисе (деньги не доверяем клиенту).
 */
export const createPaymentSchema = z.object({
  listingId: z.string().uuid(),
  amountUzs: z.number().int().positive(),
  gateway: z.enum(['click', 'payme']),
  paymentType: z.enum(['LISTING_PUBLICATION', 'VEHICLE_REPORT']).default('VEHICLE_REPORT'),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
