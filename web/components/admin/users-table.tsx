'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDateDdMmYyyy } from '@/components/admin/format-date';
import { UserStatusBadge } from '@/components/admin/user-status-badge';
import { VerifiedBadge } from '@/components/domain/verified-badge';
import { Button } from '@/components/ui/button';
import { mockFetchUsers, setUserStatus } from '@/lib/mock/admin';
import type { AdminUserRecord, UserStatus } from '@/types/admin';

// Управление пользователями (UC-16): suspend/ban у активных, восстановление
// у замороженных/забаненных. Телефон приходит из мока уже маскированным
// (BR-3, NFR-15). undefined — список ещё грузится.
export function UsersTable() {
  const t = useTranslations('admin.users');
  const [users, setUsers] = useState<AdminUserRecord[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    mockFetchUsers().then((result) => {
      if (!cancelled) setUsers(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Мок мутирует синхронно — обновляем строку возвращённой записью без refetch.
  function handleSetStatus(id: string, status: UserStatus) {
    const updated = setUserStatus(id, status);
    if (!updated) return;
    setUsers((prev) => prev?.map((user) => (user.id === updated.id ? updated : user)));
  }

  if (users === undefined) {
    return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('colUser')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('colPhone')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('colRegisteredAt')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('colListings')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('colStatus')}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t('colActions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{user.name}</span>
                  {user.verified && <VerifiedBadge />}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{user.phone}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDateDdMmYyyy(user.registeredAt)}
              </td>
              <td className="px-4 py-3">{user.listingsCount}</td>
              <td className="px-4 py-3">
                <UserStatusBadge status={user.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {user.status === 'ACTIVE' ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetStatus(user.id, 'SUSPENDED')}
                      >
                        {t('suspend')}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleSetStatus(user.id, 'BANNED')}
                      >
                        {t('ban')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetStatus(user.id, 'ACTIVE')}
                    >
                      {t('restore')}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
