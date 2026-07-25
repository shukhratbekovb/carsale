import 'dotenv/config';
import { z } from 'zod';

/**
 * Zod-валидированная конфигурация окружения (BE-0.4).
 * Инфраструктурные URL опциональны: каркас поднимается без docker-compose,
 * модули, которым нужна зависимость, падают с внятной ошибкой при старте своего клиента.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  RABBITMQ_URL: z.string().url().optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET_ORIGINALS: z.string().default('photos-originals'),
  S3_BUCKET_BLURRED: z.string().default('photos-blurred'),
  // Публичный базовый URL blurred-бакета (CDN в prod); в dev — сам MinIO-endpoint
  S3_PUBLIC_URL: z.string().url().optional(),

  ML_SERVICE_URL: z.string().url().optional(),

  // Интервалы cron-задач жизненного цикла (BE-3.7). Дефолты: EXPIRED — каждый час,
  // retry Deal Rating — каждые 5 мин.
  LISTING_EXPIRE_INTERVAL_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),
  DEALRATING_RETRY_INTERVAL_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  // Polling-fallback платежей (BE-6.5): как часто опрашивать шлюз и через какой
  // «тихий» интервал PROCESSING-платёж считается зависшим (webhook не пришёл).
  PAYMENT_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  PAYMENT_POLL_STALE_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),

  // Базовый URL фронта — для return_url и sim-URL платёжного флоу (BE-6)
  WEB_BASE_URL: z.string().url().default('http://localhost:3100'),

  // Платёжные шлюзы (BE-6, 10-integrations-api §2.2). Без креденшелов адаптеры
  // отдают sim-URL (dev). Секреты подписи webhook — dev-дефолты только для dev/test.
  CLICK_SERVICE_ID: z.string().optional(),
  CLICK_TOKEN: z.string().optional(),
  CLICK_MERCHANT_API_URL: z.string().url().optional(),
  CLICK_SECRET_KEY: z.string().default('dev-click-secret'),
  PAYME_MERCHANT_ID: z.string().optional(),
  PAYME_SECRET_KEY: z.string().default('dev-payme-secret'),

  // Доставка уведомлений (BE-7.2/7.3). Без креденшелов — Mock-адаптеры (лог).
  MAIL_FROM: z.string().default('Carsale <no-reply@carsale.uz>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:no-reply@carsale.uz'),

  ESKIZ_API_TOKEN: z.string().optional(),
  // Секреты подписи/хеширования (BE-1.2 / BE-1.4 / BE-1.6). Дефолты приемлемы
  // только для dev/test; в prod задаются через окружение (09-architecture §5).
  JWT_SECRET: z.string().default('dev-jwt-secret'),
  OTP_HASH_SECRET: z.string().default('dev-otp-hash-secret'),
  PHONE_HASH_SECRET: z.string().default('dev-phone-hash-secret'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
