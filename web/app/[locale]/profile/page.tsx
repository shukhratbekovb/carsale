import { useTranslations } from 'next-intl';
import { NotificationPreferences } from '@/components/notifications/notification-preferences';
import { ConsentSection } from '@/components/profile/consent-section';
import { GdprSection } from '@/components/profile/gdpr-section';

// Профиль (FE-7 + FE-9): настройки уведомлений (срез FE-7, frontend-plan.md
// §11), согласия на обработку ПД и GDPR-действия «Скачать данные» / «Удалить
// аккаунт» (FE-9, Epic 10, NFR-20/21, ЗРУ-547). Все секции — client-компоненты
// поверх localStorage; страница только собирает layout.
export default function ProfilePage() {
  const t = useTranslations('profile');

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('pageTitle')}</h1>
      <div className="flex flex-col gap-6">
        <NotificationPreferences />
        <ConsentSection />
        <GdprSection />
      </div>
    </main>
  );
}
