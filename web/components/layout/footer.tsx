import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Carsale</p>
        <nav className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            Политика конфиденциальности
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Пользовательское соглашение
          </Link>
        </nav>
      </div>
    </footer>
  );
}
