import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CONSENTS_STORAGE_KEY, saveConsents } from '@/lib/gdpr/consent';
import { DEVICE_STORAGE_KEYS, mockExportUserData, mockRequestAccountDeletion } from './gdpr';

// mockLatency() резолвится в пределах 300–700 мс (см. lib/mock/gdpr.ts) —
// тот же паттерн fake timers + flushLatency, что в lib/mock/admin.test.ts.
const LATENCY_MARGIN_MS = 700;

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(LATENCY_MARGIN_MS);
  return promise;
}

// Фиксированное «сейчас» из задачи: 2026-07-16 — четверг, +15 рабочих дней
// (сб/вс пропускаются) = 2026-08-06.
const NOW_ISO = '2026-07-16T09:00:00.000Z';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_ISO));
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('mockExportUserData', () => {
  test('collects every carsale:* key from localStorage into the payload', async () => {
    saveConsents({ personalData: true, marketing: false });
    localStorage.setItem('carsale:favorites', JSON.stringify(['1', '4']));
    localStorage.setItem(
      'carsale:notification-preferences',
      JSON.stringify({ NEW_MESSAGE: true, LISTING_STATUS: false })
    );
    localStorage.setItem('carsale:city', JSON.stringify('tashkent'));

    const payload = await flushLatency(mockExportUserData());

    expect(payload).toEqual({
      // Точный момент не детерминирован: advanceTimersByTimeAsync продвигает
      // системное время на случайную latency (300–700 мс) — проверяем дату.
      exportedAt: expect.stringMatching(/^2026-07-16T09:00:0/),
      // device: true маркирует «данные этого устройства», не серверный экспорт.
      device: true,
      consents: { personalData: true, marketing: false, acceptedAt: NOW_ISO },
      favorites: ['1', '4'],
      notificationPreferences: { NEW_MESSAGE: true, LISTING_STATUS: false },
      city: 'tashkent',
    });
  });

  test('turns missing and corrupted keys into null instead of failing the export', async () => {
    // Один битый ключ не должен ронять экспорт целиком.
    localStorage.setItem('carsale:favorites', '{broken-json');

    const payload = await flushLatency(mockExportUserData());

    expect(payload.favorites).toBeNull();
    expect(payload.notificationPreferences).toBeNull();
    expect(payload.city).toBeNull();
    // Согласий нет — дефолтное состояние, не null: consents читается через
    // readConsents с собственным фолбэком.
    expect(payload.consents).toEqual({ personalData: false, marketing: false });
  });
});

describe('mockRequestAccountDeletion', () => {
  test('sets dueBy to 15 business days after requestedAt, skipping weekends', async () => {
    const receipt = await flushLatency(mockRequestAccountDeletion());

    // requestedAt = «сейчас» после latency (в пределах той же даты).
    expect(receipt.requestedAt.slice(0, 10)).toBe('2026-07-16');
    // Чт 16.07 + 15 рабочих дней (три уик-энда по пути: 18–19.07, 25–26.07,
    // 01–02.08) = Чт 06.08 — точная дата из постановки задачи.
    expect(receipt.dueBy.slice(0, 10)).toBe('2026-08-06');
  });

  test('clears every known carsale:* device key from localStorage', async () => {
    saveConsents({ personalData: true, marketing: true });
    localStorage.setItem('carsale:favorites', JSON.stringify(['2']));
    localStorage.setItem('carsale:notification-preferences', JSON.stringify({}));
    localStorage.setItem('carsale:city', JSON.stringify('samarkand'));
    // Санити: согласия действительно лежали в carsale:consents до удаления.
    expect(localStorage.getItem(CONSENTS_STORAGE_KEY)).not.toBeNull();

    await flushLatency(mockRequestAccountDeletion());

    DEVICE_STORAGE_KEYS.forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull();
    });
  });
});
