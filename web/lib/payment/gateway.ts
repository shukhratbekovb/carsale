import { PAYMENT_GATEWAY_VALUES, type PaymentGateway } from '@/types/payment';

// Fallback-логика между Click/Payme (R-10, docs/analysis/12-risks-assumptions.md:22:
// «Fallback на второй шлюз, если один недоступен/отклонён»). Чистые функции —
// вся навигация/сайд-эффекты остаются в компонентах страниц оплаты.

export function otherGateway(gateway: PaymentGateway): PaymentGateway {
  return gateway === 'click' ? 'payme' : 'click';
}

// Список неудачных попыток кодируется в query (?failed=click,payme) — между
// /payment/[listingId] и /payment/return нет общего компонента, где мог бы
// жить reducer (это разные страницы редиректного флоу), поэтому состояние
// «что уже не сработало» передаётся через URL, как и остальные параметры флоу.
export function parseFailedGateways(value: string | null): PaymentGateway[] {
  if (!value) return [];
  const seen = new Set<PaymentGateway>();
  for (const raw of value.split(',')) {
    if ((PAYMENT_GATEWAY_VALUES as readonly string[]).includes(raw)) {
      seen.add(raw as PaymentGateway);
    }
  }
  return [...seen];
}

export function encodeFailedGateways(gateways: PaymentGateway[]): string {
  return [...new Set(gateways)].join(',');
}

export function bothGatewaysFailed(failed: PaymentGateway[]): boolean {
  return PAYMENT_GATEWAY_VALUES.every((gateway) => failed.includes(gateway));
}
