import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

/**
 * Порт email-доставки (BE-7.2, I-4). Реализации: SmtpMailer (SendGrid/SES/любой
 * SMTP через nodemailer) и MockMailer (dev/тесты — логирует, не шлёт). Фабрика
 * выбирает по наличию SMTP_HOST. Шаблон простой: subject=заголовок, тело —
 * сообщение + ссылка (строки уже локализованы вызывающим, как в notify()).
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  link?: string;
}

export interface Mailer {
  send(msg: MailMessage): Promise<void>;
}

function renderBody(msg: MailMessage): string {
  return msg.link ? `${msg.text}\n\n${env.WEB_BASE_URL}${msg.link}` : msg.text;
}

export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      ...(env.SMTP_USER && env.SMTP_PASS
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
        : {}),
    });
  }

  async send(msg: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: env.MAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      text: renderBody(msg),
    });
  }
}

/** Dev/тесты: логирует «отправку», никогда не падает и не шлёт реально. */
export class MockMailer implements Mailer {
  async send(msg: MailMessage): Promise<void> {
    logger.info({ to: msg.to, subject: msg.subject }, 'mock-mail: email "sent"');
    return Promise.resolve();
  }
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (!mailer) {
    if (env.SMTP_HOST) {
      logger.info('mailer: using SMTP');
      mailer = new SmtpMailer();
    } else {
      logger.info('mailer: SMTP_HOST unset — using MockMailer (dev)');
      mailer = new MockMailer();
    }
  }
  return mailer;
}

/** Сброс синглтона (тесты). */
export function __resetMailer(): void {
  mailer = null;
}
