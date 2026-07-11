import { defineRouting } from 'next-intl/routing';

// UZ-first (PRD §2): узбекский — локаль по умолчанию и живёт без префикса
// (`/catalog`), русский — под `/ru/...`. 'as-needed' сохраняет все существующие
// URL рабочими и не дублирует контент по умолчанию под двумя путями (SEO).
export const routing = defineRouting({
  locales: ['uz', 'ru'],
  defaultLocale: 'uz',
  localePrefix: 'as-needed',
});

export type AppLocale = (typeof routing.locales)[number];
