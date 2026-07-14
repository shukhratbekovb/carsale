import type { CreatedPayment, PaymentOrder } from '@/types/payment';

// Мок замена реальным Click/Payme интеграциям (I-2/I-3, docs/analysis/
// 10-integrations-api.md) до готовности Core API. Реальный Click-контракт —
// POST /v2/merchant/invoice/create с return_url → { payment_url } — здесь
// paymentUrl указывает на внутреннюю страницу-имитацию шлюза (gateway-sim),
// а не на настоящий домен click.uz/payme.uz.

// Цена платного отчёта о проверке авто (FR-10: «оплата за публикацию и/или
// расширенный отчёт»; здесь фронтенд демонстрирует именно ветку отчёта —
// публикация объявления в MVP бесплатна, docs/analysis/03-use-case-model.md:207).
export const VEHICLE_REPORT_PRICE_UZS = 45_000;

const MIN_LATENCY_MS = 500;
const MAX_LATENCY_MS = 1000;

function mockLatency(): Promise<void> {
  const delay = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Создание платежа (аналог Click invoice/create). В моке всегда успешно —
// «недоступность шлюза» и «отклонённый платёж» демонстрируются интерактивно
// на странице-имитации шлюза (gateway-sim), не случайным сбоем здесь: так
// сценарий воспроизводим при живой проверке и в тестах, а не зависит от RNG.
export async function mockCreatePayment(order: PaymentOrder): Promise<CreatedPayment> {
  await mockLatency();

  const transactionId = `pay_${crypto.randomUUID()}`;
  const paymentUrl = `/payment/gateway-sim?${new URLSearchParams({
    tx: transactionId,
    gateway: order.gateway,
    listingId: order.listingId,
    amount: String(order.amountUzs),
  }).toString()}`;

  return { transactionId, paymentUrl };
}
