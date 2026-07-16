import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { UserStatus } from '@/types/admin';

// UC-16: нейтральный (активен) / предупреждение (заморожен) / деструктивный
// (забанен) — токены из globals.css, паттерн DealRatingBadge.
const STYLES: Record<UserStatus, string> = {
  ACTIVE: 'bg-muted text-muted-foreground',
  SUSPENDED: 'bg-warning text-warning-foreground',
  BANNED: 'bg-destructive text-destructive-foreground',
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const t = useTranslations('admin');

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        STYLES[status]
      )}
    >
      {t(`userStatus.${status}`)}
    </span>
  );
}
