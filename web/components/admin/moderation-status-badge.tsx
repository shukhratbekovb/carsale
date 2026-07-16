import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { ModerationStatus } from '@/types/admin';

// Тот же паттерн, что DealRatingBadge: цветовая семантика через токены
// (нейтральный/успех/деструктивный) + обязательная текстовая метка.
const STYLES: Record<ModerationStatus, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  APPROVED: 'bg-success text-success-foreground',
  REJECTED: 'bg-destructive text-destructive-foreground',
};

export function ModerationStatusBadge({ status }: { status: ModerationStatus }) {
  const t = useTranslations('admin');

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        STYLES[status]
      )}
    >
      {t(`moderationStatus.${status}`)}
    </span>
  );
}
