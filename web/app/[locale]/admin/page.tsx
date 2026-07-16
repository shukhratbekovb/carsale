'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { StatTile } from '@/components/admin/stat-tile';
import { mockFetchAnalytics } from '@/lib/mock/admin';
import type { PlatformAnalytics } from '@/types/admin';

// Ключи PlatformAnalytics в порядке отображения плиток; подписи — из
// admin.analytics.* (совпадают по имени с ключами данных).
const STAT_KEYS = [
  'totalListings',
  'activeListings',
  'pendingModeration',
  'rejectedListings',
  'totalUsers',
  'activeUsers30d',
  'newListings7d',
  'newUsers7d',
] as const satisfies readonly (keyof PlatformAnalytics)[];

// Базовая аналитика (UC-17): только числа + подписи, без chart-библиотек.
// CSR: аналитика живая — pending/rejected пересчитываются моком после решений
// модератора, поэтому данные тянутся в useEffect (первый рендер — плейсхолдер).
export default function AdminAnalyticsPage() {
  const t = useTranslations('admin.analytics');
  const [analytics, setAnalytics] = useState<PlatformAnalytics | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    mockFetchAnalytics().then((result) => {
      if (!cancelled) setAnalytics(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{t('heading')}</h2>
      {analytics === undefined ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_KEYS.map((key) => (
            <StatTile key={key} label={t(key)} value={analytics[key]} />
          ))}
        </div>
      )}
    </section>
  );
}
