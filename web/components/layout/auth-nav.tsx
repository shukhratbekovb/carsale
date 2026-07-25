'use client';

import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/auth/session';

/**
 * Правый край шапки, зависящий от сессии (§5). Гость — ссылка «Войти».
 * Авторизован — ссылка в кабинет + «Выйти». В состоянии loading (пока идёт
 * bootstrap-refresh) не мигаем: показываем нейтральный плейсхолдер той же ширины.
 */
export function AuthNav() {
  const t = useTranslations('nav');
  const router = useRouter();
  const { status, signOut } = useSession();

  const linkClass =
    'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border px-3 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4';

  if (status === 'loading') {
    return <div aria-hidden className="h-9 w-16 rounded-md border bg-muted/40" />;
  }

  if (status === 'authenticated') {
    return (
      <div className="flex items-center gap-2">
        <Link href="/my-listings" className={linkClass}>
          {t('account')}
        </Link>
        <button
          type="button"
          onClick={() => {
            void signOut().then(() => router.push('/'));
          }}
          className={linkClass}
        >
          {t('logout')}
        </button>
      </div>
    );
  }

  return (
    <Link href="/auth/login" className={linkClass}>
      {t('login')}
    </Link>
  );
}
