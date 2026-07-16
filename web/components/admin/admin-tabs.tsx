'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

// exact — только для корня /admin (аналитика), иначе он «активен» на всех
// вложенных разделах; /admin/moderation подсвечивается и на карточке [id].
const TABS = [
  { href: '/admin', labelKey: 'analytics', exact: true },
  { href: '/admin/moderation', labelKey: 'moderation', exact: false },
  { href: '/admin/users', labelKey: 'users', exact: false },
] as const;

export function AdminTabs() {
  const t = useTranslations('admin');
  const pathname = usePathname();

  return (
    <nav aria-label={t('tabsLabel')} className="border-b">
      <ul className="-mb-px flex gap-1">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                {t(`tabs.${tab.labelKey}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
