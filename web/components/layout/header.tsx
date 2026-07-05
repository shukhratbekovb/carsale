import Link from 'next/link';
import { LocationPicker } from '@/components/layout/location-picker';

const NAV_LINKS = [
  { href: '/catalog', label: 'Каталог' },
  { href: '/favorites', label: 'Избранное' },
  { href: '/my-listings', label: 'Мои объявления' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="shrink-0 text-lg font-bold">
          Carsale
        </Link>
        <LocationPicker />
        <nav className="hidden items-center gap-4 md:flex">
          {NAV_LINKS.map((link) => (
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
          {/* Реальное переключение языка (next-intl) — отдельный шаг, frontend-plan.md §13.7 */}
          <div className="hidden items-center gap-1 rounded-full border px-1 py-0.5 text-xs sm:flex">
            <span className="rounded-full px-2 py-0.5 text-muted-foreground">UZ</span>
            <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
              RU
            </span>
          </div>
          <Link
            href="/sell/new"
            className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Продать авто
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Войти
          </Link>
        </div>
      </div>
    </header>
  );
}
