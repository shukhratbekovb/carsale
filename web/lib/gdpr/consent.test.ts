import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_CONSENT_STATE } from '@/types/gdpr';
import { CONSENTS_STORAGE_KEY, readConsents, saveConsents, setMarketingConsent } from './consent';

// Фиксируем «сейчас», чтобы проверять acceptedAt точным значением, а не
// expect.any(String) — момент принятия согласия юридически значим (ЗРУ-547).
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

describe('readConsents', () => {
  test('returns the default state when nothing is stored', () => {
    expect(readConsents()).toEqual(DEFAULT_CONSENT_STATE);
  });

  test('returns the default state when the stored JSON is corrupted', () => {
    localStorage.setItem(CONSENTS_STORAGE_KEY, '{not-json');

    expect(readConsents()).toEqual(DEFAULT_CONSENT_STATE);
  });

  test('returns the persisted state after saveConsents', () => {
    saveConsents({ personalData: true, marketing: true });

    expect(readConsents()).toEqual({
      personalData: true,
      marketing: true,
      acceptedAt: NOW_ISO,
    });
  });
});

describe('saveConsents', () => {
  test('stamps acceptedAt with the current moment and persists to localStorage', () => {
    const saved = saveConsents({ personalData: true, marketing: false });

    expect(saved).toEqual({ personalData: true, marketing: false, acceptedAt: NOW_ISO });
    // Персистится в localStorage, не только возвращается вызывающему.
    expect(JSON.parse(localStorage.getItem(CONSENTS_STORAGE_KEY)!)).toEqual(saved);
  });
});

describe('setMarketingConsent', () => {
  test('changes only the marketing flag, keeping personalData and acceptedAt intact', () => {
    saveConsents({ personalData: true, marketing: false });

    // Позже пользователь включает маркетинг из профиля — момент принятия
    // базового согласия не переписывается.
    vi.setSystemTime(new Date('2026-07-20T12:00:00.000Z'));
    const updated = setMarketingConsent(true);

    expect(updated).toEqual({ personalData: true, marketing: true, acceptedAt: NOW_ISO });
    expect(readConsents()).toEqual(updated);
  });

  test('can revoke the marketing consent without touching the rest of the state', () => {
    saveConsents({ personalData: true, marketing: true });

    const updated = setMarketingConsent(false);

    expect(updated).toEqual({ personalData: true, marketing: false, acceptedAt: NOW_ISO });
    expect(readConsents()).toEqual(updated);
  });
});
