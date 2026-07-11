import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Carsale</p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            {t('privacy')}
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            {t('terms')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
