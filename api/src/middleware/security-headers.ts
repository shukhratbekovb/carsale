import type { RequestHandler } from 'express';

/**
 * Заголовки безопасности (BE-10.5, NFR-12, OWASP Secure Headers). Core отдаёт
 * JSON и стоит за BFF-прокси фронта — заголовки это defense-in-depth (clickjacking,
 * MIME-sniffing, утечка referrer, кросс-origin чтение). HSTS применяется браузером
 * только по HTTPS (по http игнорируется), поэтому шлём всегда — в проде за TLS он
 * включит строгий транспорт, в dev безвреден. CSP максимально строгая: API не
 * рендерит HTML, ничего грузить не должен.
 */
const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'no-referrer'],
  ['Cross-Origin-Resource-Policy', 'same-origin'],
  ['X-Permitted-Cross-Domain-Policies', 'none'],
  ['Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'"],
];

export const securityHeaders: RequestHandler = (_req, res, next) => {
  for (const [name, value] of SECURITY_HEADERS) res.setHeader(name, value);
  next();
};
