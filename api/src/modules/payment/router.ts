// Payment Module (BE-6, FR-10, §6.5, ADR-002): POST /payments/create, webhooks Click/Payme,
// идемпотентность по gateway_transaction_id, polling fallback 5 мин
import { stubRouter } from '../stub-router.js';

export const paymentRouter = stubRouter('payment');
