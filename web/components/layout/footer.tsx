import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Carsale</p>
        {/* flex-wrap обязателен: три ссылки в один ряд не помещаются в 360px
            (ловилось вьюпорт-гейтом NFR-24 на CI — Linux-рендер шрифта чуть
            шире, ряд был 384px и давал горизонтальный скролл всей странице) */}
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link href="/privacy" className="hover:text-foreground">
            {t('privacy')}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {t('terms')}
          </Link>
          {/* Админка сознательно не в шапке: не публичная навигация,
              неприметная ссылка для демо (FE-8) */}
          <Link href="/admin" className="hover:text-foreground">
            {t('admin')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
