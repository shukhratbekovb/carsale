import { useTranslations } from 'next-intl';
import { NotificationPreferences } from '@/components/notifications/notification-preferences';

// /profile целиком принадлежит FE-9 (Профиль, GDPR, i18n завершение —
// экран профиля, «Скачать данные»/«Удалить аккаунт», согласия при
// регистрации). Пока реализована только секция настроек уведомлений —
// срез FE-7 («Настройки уведомлений в профиле», frontend-plan.md §11).
// FE-9 расширит эту же страницу остальными разделами, не создаёт новую.
export default function ProfilePage() {
  const t = useTranslations('profile');

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('pageTitle')}</h1>
      <NotificationPreferences />
    </main>
  );
}
