import { DEFAULT_CONSENT_STATE, type ConsentState } from '@/types/gdpr';

// Хранение согласий на обработку ПД (FE-9, ЗРУ-547) — device-local, в
// localStorage. Чтение/запись напрямую, без React-хука — тот же паттерн, что
// readPreferences в lib/mock/notifications.ts: функции вызываются и из
// mock-модулей (экспорт данных в lib/mock/gdpr.ts), где нет react-контекста.

export const CONSENTS_STORAGE_KEY = 'carsale:consents';

// SSR-safe: на сервере (без window) возвращает дефолт — согласия ещё не даны.
export function readConsents(): ConsentState {
  if (typeof window === 'undefined') return DEFAULT_CONSENT_STATE;
  try {
    const raw = window.localStorage.getItem(CONSENTS_STORAGE_KEY);
    return raw ? { ...DEFAULT_CONSENT_STATE, ...JSON.parse(raw) } : DEFAULT_CONSENT_STATE;
  } catch {
    return DEFAULT_CONSENT_STATE;
  }
}

function writeConsents(consents: ConsentState): ConsentState {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CONSENTS_STORAGE_KEY, JSON.stringify(consents));
    } catch {
      // Квота/приватный режим — согласие остаётся в памяти вызывающего,
      // но не персистится; не роняем UI-флоу из-за localStorage.
    }
  }
  return consents;
}

// Явное принятие согласий (например, при регистрации): фиксирует момент
// принятия в acceptedAt.
export function saveConsents(consents: Omit<ConsentState, 'acceptedAt'>): ConsentState {
  return writeConsents({ ...consents, acceptedAt: new Date().toISOString() });
}

// Точечный отзыв/выдача маркетингового согласия из настроек профиля
// (PRD 7.2). Не трогает personalData и acceptedAt: юридически значимый момент
// принятия базового согласия не переписывается при переключении маркетинга.
export function setMarketingConsent(enabled: boolean): ConsentState {
  return writeConsents({ ...readConsents(), marketing: enabled });
}
