'use client';

import { useTranslations } from 'next-intl';
import { RequireAuth } from '@/components/auth/require-auth';
import { MyListingsList } from '@/components/my-listings/my-listings-list';

// Продавец, auth-walled dashboard (frontend-plan.md §5, /my-listings — P0,
// FR-05, UC-12). RequireAuth редиректит гостя на логин; авторизованный видит свои
// объявления из Core `GET /my/listings` (§5) — статусы модерации, Deal Rating.
export default function MyListingsPage() {
  const t = useTranslations('myListings');

  return (
    <RequireAuth>
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
        <h1 className="text-2xl font-bold">{t('pageTitle')}</h1>
        <MyListingsList />
      </main>
    </RequireAuth>
  );
}
