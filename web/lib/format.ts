import type { AppLocale } from '@/i18n/routing';

// NFR-29: цены форматируются как "1 000 000 сум" / "1 000 000 soʻm", не "1000000".
//
// 'uz'/'uz-UZ' у Intl.NumberFormat по-разному реализован в Node (SSR) и в
// движках браузеров (CSR) — найдено живой проверкой /payment: сервер отдавал
// "45 000", клиент после гидратации — "45,000" для одного и того же числа
// (React hydration mismatch). У 'ru-RU' такого расхождения нет (оба окружения
// согласны), поэтому только узбекская ветка форматируется вручную —
// детерминированная группировка по тысячам не зависит от ICU-данных рантайма.
function groupThousands(value: number): string {
  const sign = value < 0 ? '-' : '';
  const digits = Math.trunc(Math.abs(value)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatNumber(value: number, locale: string): string {
  return locale === 'uz' ? groupThousands(value) : new Intl.NumberFormat('ru-RU').format(value);
}

const UNIT_SUFFIXES: Record<AppLocale, { uzs: string; km: string }> = {
  uz: { uzs: 'soʻm', km: 'km' },
  ru: { uzs: 'сум', km: 'км' },
};

function suffixesFor(locale: string) {
  return UNIT_SUFFIXES[locale as AppLocale] ?? UNIT_SUFFIXES.ru;
}

export function formatUzs(amountUzs: number, locale: string): string {
  return `${formatNumber(amountUzs, locale)} ${suffixesFor(locale).uzs}`;
}

export function formatMileage(mileageKm: number, locale: string): string {
  return `${formatNumber(mileageKm, locale)} ${suffixesFor(locale).km}`;
}

// Даты (админка FE-8, GDPR-квитанции FE-9) — фиксированный формат ДД.ММ.ГГГГ
// от UTC-компонентов ISO-строки. Intl.DateTimeFormat сознательно не
// используется: локале- и таймзоно-зависимый вывод уже дважды ловил hydration
// mismatch в проекте (см. комментарий про Intl.NumberFormat('uz') выше).
// Перенесено из components/admin/format-date.ts, когда формат понадобился
// за пределами админки (FE-9).
export function formatDateDdMmYyyy(isoDate: string): string {
  const date = new Date(isoDate);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getUTCFullYear()}`;
}
