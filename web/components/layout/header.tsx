import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { LocationPicker } from '@/components/layout/location-picker';
import { Link } from '@/i18n/navigation';

export function Header() {
  const t = useTranslations('nav');

  const navLinks = [
    { href: '/catalog', label: t('catalog') },
    { href: '/favorites', label: t('favorites') },
    { href: '/my-listings', label: t('myListings') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="shrink-0 text-lg font-bold">
          Carsale
        </Link>
        <LocationPicker />
        <nav className="hidden items-center gap-4 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {/* useSearchParams внутри LanguageSwitcher требует Suspense-границу в SSR. */}
          <Suspense fallback={null}>
            <LanguageSwitcher />
          </Suspense>
          <Link
            href="/sell/new"
            className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('sell')}
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('login')}
          </Link>
        </div>
      </div>
    </header>
  );
}
