'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/auth/session';

/**
 * Гвард защищённых страниц (§5). Гостя редиректит на /auth/login с return на
 * текущий путь (после входа вернёт назад); пока сессия восстанавливается
 * (loading) или до редиректа — показывает нейтральный скелет, а не защищённый
 * контент. Редирект клиентский: сессия живёт в памяти (access-токен из refresh
 * cookie), сервер её не знает — серверный гвард потребовал бы читать cookie в
 * middleware, это отдельный шаг.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace(`/auth/login?return=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  if (status !== 'authenticated') {
    return (
      <div aria-hidden className="mx-auto flex max-w-md flex-col gap-3 px-4 py-16">
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return <>{children}</>;
}
