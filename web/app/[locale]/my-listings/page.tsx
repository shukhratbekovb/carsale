'use client';

import { useTranslations } from 'next-intl';
import { RequireAuth } from '@/components/auth/require-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

// Продавец, auth-walled dashboard (frontend-plan.md §5, /my-listings — P0,
// FR-05, UC-12). Теперь есть реальная сессия (§5): RequireAuth редиректит гостя
// на логин, авторизованный видит свой кабинет. Список объявлений продавца
// (GET /my/listings) подключится следующим срезом интеграции — пока плейсхолдер.
export default function MyListingsPage() {
  const t = useTranslations('myListings');

  return (
    <RequireAuth>
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>{t('pageTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div>
              <p className="font-semibold">{t('emptyTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('emptyMessage')}</p>
            </div>
            <Link
              href="/sell/new"
              className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('createListing')}
            </Link>
          </CardContent>
        </Card>
      </main>
    </RequireAuth>
  );
}
