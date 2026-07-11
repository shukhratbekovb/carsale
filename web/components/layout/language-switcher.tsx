'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

// Переключение UZ/RU без перезагрузки страницы (NFR-28): router.replace с
// опцией locale — клиентская навигация на тот же pathname под другим префиксом.
// Query-параметры сохраняем, чтобы не терять фильтры каталога/`return` в auth.
export function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchTo(nextLocale: AppLocale) {
    if (nextLocale === locale) return;
    const query = searchParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { locale: nextLocale });
  }

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="hidden items-center gap-1 rounded-full border px-1 py-0.5 text-xs sm:flex"
    >
      {routing.locales.map((availableLocale) => (
        <button
          key={availableLocale}
          type="button"
          aria-pressed={availableLocale === locale}
          onClick={() => switchTo(availableLocale)}
          className={cn(
            'rounded-full px-2 py-0.5 uppercase',
            availableLocale === locale
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {availableLocale}
        </button>
      ))}
    </div>
  );
}
