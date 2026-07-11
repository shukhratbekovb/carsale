import { BadgeCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function VerifiedBadge() {
  const t = useTranslations('listing');

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {t('verified')}
    </span>
  );
}
