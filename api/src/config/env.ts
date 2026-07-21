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

  ML_SERVICE_URL: z.string().url().optional(),

  ESKIZ_API_TOKEN: z.string().optional(),
  // Секреты подписи/хеширования (BE-1.2 / BE-1.4 / BE-1.6). Дефолты приемлемы
  // только для dev/test; в prod задаются через окружение (09-architecture §5).
  JWT_SECRET: z.string().default('dev-jwt-secret'),
  OTP_HASH_SECRET: z.string().default('dev-otp-hash-secret'),
  PHONE_HASH_SECRET: z.string().default('dev-phone-hash-secret'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
