// Типы для FE-6 (Оплата, FR-10, UC-11, docs/analysis/03-use-case-model.md:378-405).
// Оба шлюза с первого дня (решение зафиксировано 2026-07-05) — экран выбора,
// redirect-flow, return-страница, fallback на второй шлюз при отказе/недоступности
// первого (R-10, docs/analysis/12-risks-assumptions.md:22).

export type PaymentGateway = 'click' | 'payme';

export const PAYMENT_GATEWAY_VALUES = ['click', 'payme'] as const satisfies readonly PaymentGateway[];

// Соответствует внутреннему фасаду FE↔Payment API из
// docs/analysis/06-sequence-diagrams.md:260-265: POST /payments/create
// { listing_id, amount, gateway } → { payment_url }.
export interface PaymentOrder {
  listingId: string;
  amountUzs: number;
  gateway: PaymentGateway;
}

export interface CreatedPayment {
  transactionId: string;
  paymentUrl: string;
}

export type PaymentOutcome = 'success' | 'declined';
