import type { AppLocale } from '@/i18n/routing';

// NFR-29: цены форматируются как "1 000 000 сум" / "1 000 000 soʻm", не "1000000".
// Локаль обязательна в сигнатуре, чтобы ни один вызов не «забыл» про UZ;
// неизвестное значение (например, из невалидированных params) откатывается на ru.
const LOCALE_FORMATS: Record<AppLocale, { numberLocale: string; uzs: string; km: string }> = {
  uz: { numberLocale: 'uz', uzs: 'soʻm', km: 'km' },
  ru: { numberLocale: 'ru-RU', uzs: 'сум', km: 'км' },
};

function formatsFor(locale: string) {
  return LOCALE_FORMATS[locale as AppLocale] ?? LOCALE_FORMATS.ru;
}

export function formatUzs(amountUzs: number, locale: string): string {
  const { numberLocale, uzs } = formatsFor(locale);
  return `${new Intl.NumberFormat(numberLocale).format(amountUzs)} ${uzs}`;
}

export function formatMileage(mileageKm: number, locale: string): string {
  const { numberLocale, km } = formatsFor(locale);
  return `${new Intl.NumberFormat(numberLocale).format(mileageKm)} ${km}`;
}
