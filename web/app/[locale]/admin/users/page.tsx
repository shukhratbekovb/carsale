'use client';

import { useTranslations } from 'next-intl';
import { UsersTable } from '@/components/admin/users-table';

// Управление пользователями (FE-8, UC-16). CSR: список мутирует после
// suspend/ban/restore, UsersTable тянет его в useEffect.
export default function AdminUsersPage() {
  const t = useTranslations('admin.users');

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{t('heading')}</h2>
      <UsersTable />
    </section>
  );
}
