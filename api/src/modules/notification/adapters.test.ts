import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({
  env: { NODE_ENV: 'test', WEB_BASE_URL: 'http://localhost:3100', SMTP_PORT: 587, VAPID_SUBJECT: 'mailto:x' },
}));

import { __resetMailer, getMailer, MockMailer } from './mailer.js';
import { __resetPushSender, getPushSender, MockPushSender } from './push.js';

afterEach(() => {
  __resetMailer();
  __resetPushSender();
});

describe('notification adapters — Mock без креденшелов (BE-7.2/7.3)', () => {
  it('getMailer без SMTP_HOST → MockMailer, send не падает', async () => {
    const m = getMailer();
    expect(m).toBeInstanceOf(MockMailer);
    await expect(m.send({ to: 'a@b.uz', subject: 'S', text: 'T' })).resolves.toBeUndefined();
  });

  it('getPushSender без VAPID → MockPushSender, send → gone:false', async () => {
    const p = getPushSender();
    expect(p).toBeInstanceOf(MockPushSender);
    await expect(
      p.send({ endpoint: 'https://push/x', keys: { p256dh: 'p', auth: 'a' } }, { title: 'T', message: 'M' }),
    ).resolves.toEqual({ gone: false });
  });
});
