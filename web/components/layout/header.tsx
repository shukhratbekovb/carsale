import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { LocationPicker } from '@/components/layout/location-picker';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Link } from '@/i18n/navigation';

export function Header() {
  const t = useTranslations('nav');

  const navLinks = [
    { href: '/catalog', label: t('catalog') },
    { href: '/favorites', label: t('favorites') },
    { href: '/my-listings', label: t('myListings') },
    { href: '/chat', label: t('chat') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      {/* NFR-24: flex-wrap — на <lg навигация переносится на вторую строку шапки
          (order-last + w-full), поэтому все ссылки доступны и на 360px без
          горизонтального скролла. На lg+ строка одна, фиксированной высоты. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 lg:h-16 lg:flex-nowrap lg:py-0">
        <Link href="/" className="shrink-0 text-lg font-bold">
          Carsale
        </Link>
        {/* Город прячем на самых узких экранах, чтобы верхняя строка влезала в 360px. */}
        <div className="hidden sm:block">
          <LocationPicker />
        </div>
        <nav className="order-last flex w-full flex-wrap items-center gap-x-4 gap-y-1 lg:order-none lg:w-auto">
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
          <NotificationBell />
          <Suspense fallback={null}>
            <LanguageSwitcher />
          </Suspense>
          <Link
            href="/sell/new"
            className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
          >
            {t('sell')}
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border px-3 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
          >
            {t('login')}
          </Link>
        </div>
      </div>
    </header>
  );
}
