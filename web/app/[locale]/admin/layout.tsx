import { useTranslations } from 'next-intl';
import { AdminTabs } from '@/components/admin/admin-tabs';

// Секционный layout админ-панели (FE-8, UC-15/16/17). Auth-гейта сознательно
// нет: в приложении нигде нет концепции сессии/ролей (как у /chat и
// /my-listings) — панель работает как демо-фича, RBAC/сессии администратора
// придут вместе с Core API (об этом же говорит demoBanner ниже).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">{t('title')}</h1>
      <p className="mb-4 rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
        {t('demoBanner')}
      </p>
      <AdminTabs />
      <div className="py-6">{children}</div>
    </main>
  );
}
