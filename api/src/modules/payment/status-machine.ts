import type { PaymentStatus } from '@prisma/client';
import { AppError } from '../../lib/errors.js';

/**
 * Статусная машина Payment (BE-6.3, 07-process-and-state §2.3). Чистый модуль —
 * та же идиома, что listing/status-machine.ts. Переходы:
 *
 *   PENDING    → PROCESSING (redirect на шлюз) | CANCELLED
 *   PROCESSING → SUCCESS | FAILED | CANCELLED (webhook / таймаут 30 мин)
 *   FAILED     → PENDING (пользователь повторяет попытку)
 *   SUCCESS    → REFUNDED (возврат, P2)
 *
 * SUCCESS / CANCELLED / REFUNDED — терминальные (REFUNDED только из SUCCESS).
 */
const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SUCCESS', 'FAILED', 'CANCELLED'],
  FAILED: ['PENDING'],
  SUCCESS: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError(409, 'invalid_status_transition', `Cannot move payment ${from} → ${to}`, {
      from,
      to,
    });
  }
}

/** Терминальный статус — дальнейшие webhook'и по нему идемпотентны (реплей → 200). */
export function isTerminal(status: PaymentStatus): boolean {
  return TRANSITIONS[status].length === 0 || status === 'SUCCESS';
}
