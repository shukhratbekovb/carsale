import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

/**
 * Порт SMS-шлюза (BE-1.1, ADR-001). Отправляет OTP-код на номер.
 * Реализации: EskizSmsGateway (prod) и MockSmsGateway (dev/тесты).
 * Контракт Eskiz — docs/analysis/10-integrations-api.md §2.1, поведение
 * ретраев/недоступности — §3.1 и §6.1.
 */
export interface SmsGateway {
  /** Канонический номер `998XXXXXXXXX` (см. normalizePhone) и 6-значный код. */
  sendOtp(phone: string, code: string): Promise<void>;
}

const ESKIZ_URL = 'https://notify.eskiz.uz/api/message/sms/send';
const ESKIZ_FROM = '4546';
const REQUEST_TIMEOUT_MS = 5_000;
// Задержки перед повторами (§3.1: retry 1 через 2с, retry 2 через 5с).
// Конфигурируемы, чтобы тесты гоняли без реального ожидания.
const DEFAULT_RETRY_DELAYS_MS = [2_000, 5_000];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface EskizOptions {
  token: string;
  /** Задержки повторов в мс; длина = число повторов после первой попытки. */
  retryDelaysMs?: number[];
}

export class EskizSmsGateway implements SmsGateway {
  private readonly token: string;
  private readonly retryDelaysMs: number[];

  constructor(opts: EskizOptions) {
    this.token = opts.token;
    this.retryDelaysMs = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const message = `Carsale: tasdiqlash kodi ${code}. Hech kimga aytmang.`;
    const body = JSON.stringify({ mobile_phone: phone, message, from: ESKIZ_FROM });

    // 1 первичная попытка + N повторов из retryDelaysMs
    const attempts = this.retryDelaysMs.length + 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        await this.send(body);
        return;
      } catch (err) {
        // invalid_phone (422) не ретраится — это ошибка ввода, не доступности
        if (err instanceof AppError && err.code === 'invalid_phone') throw err;
        const isLast = attempt === attempts - 1;
        if (isLast) {
          logger.error({ attempt }, 'eskiz: all send attempts failed');
          throw new AppError(503, 'sms_unavailable', 'SMS service is temporarily unavailable');
        }
        const delay = this.retryDelaysMs[attempt] ?? 0;
        logger.warn({ attempt, delay }, 'eskiz: send failed, retrying');
        await sleep(delay);
      }
    }
  }

  private async send(body: string): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(ESKIZ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.ok) return;

    // 422 — неверный формат номера: сразу наружу как 400, без ретраев
    if (res.status === 422) {
      throw new AppError(400, 'invalid_phone', 'SMS gateway rejected the phone number');
    }
    // 401 — истёк токен (ops-задача обновления, здесь только деградация); 429/5xx — ретраим
    if (res.status === 401) {
      logger.error('eskiz: 401 unauthorized — API token likely expired');
    }
    // любой прочий не-ok статус → бросаем, внешний цикл решит ретраить/сдаться
    throw new Error(`eskiz responded ${res.status}`);
  }
}

/** Заглушка для dev/тестов: логирует код на info, никогда не падает. */
export class MockSmsGateway implements SmsGateway {
  async sendOtp(phone: string, code: string): Promise<void> {
    // Номер логируем только последними 4 цифрами — raw-телефон не пишем (NFR-15)
    logger.info({ phoneTail: phone.slice(-4), code }, 'mock-sms: OTP "sent"');
    return Promise.resolve();
  }
}

/**
 * Фабрика: Eskiz, если задан ESKIZ_API_TOKEN, иначе Mock.
 * Выбор логируется при старте (info).
 */
export function createSmsGateway(): SmsGateway {
  if (env.ESKIZ_API_TOKEN) {
    logger.info('sms-gateway: using Eskiz UZ');
    return new EskizSmsGateway({ token: env.ESKIZ_API_TOKEN });
  }
  logger.info('sms-gateway: ESKIZ_API_TOKEN unset — using MockSmsGateway (dev)');
  return new MockSmsGateway();
}
