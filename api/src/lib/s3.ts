import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

/**
 * Обёртка над S3-совместимым хранилищем (MinIO) — BE-0.8.
 * originals — private bucket, blurred — public → CDN (BR-3, NFR-8).
 * Имена бакетов приходят из env: S3_BUCKET_ORIGINALS / S3_BUCKET_BLURRED.
 * Ленивый синглтон: импорт модуля не требует настроенного S3.
 */
let client: S3Client | null = null;

export type S3Body = Buffer | Uint8Array | string | Readable;

export function getS3(): S3Client {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
    throw new AppError(
      503,
      's3_not_configured',
      'S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY are not set — object storage is unavailable (start infra/docker-compose and set S3_* vars)',
    );
  }
  if (!client) {
    client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      // MinIO игнорирует регион, но SDK требует значение
      region: 'us-east-1',
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      // MinIO работает по path-style URL (bucket в пути, не в поддомене)
      forcePathStyle: true,
    });
  }
  return client;
}

export async function putObject(
  bucket: string,
  key: string,
  body: S3Body,
  contentType: string,
): Promise<void> {
  await getS3().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function getObjectStream(bucket: string, key: string): Promise<Readable> {
  const res = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) {
    throw new AppError(404, 'not_found', `Object ${bucket}/${key} has no body`);
  }
  // В Node-рантайме Body всегда Readable
  return res.Body as Readable;
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Сброс синглтона (graceful shutdown / тесты). */
export function closeS3(): void {
  client?.destroy();
  client = null;
}
