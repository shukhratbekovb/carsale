'use client';

import { useTranslations } from 'next-intl';
import { ModerationQueue } from '@/components/admin/moderation-queue';

// Очередь модерации фрод-флагов (FE-8, UC-15 шаг 2). CSR: очередь мутирует
// после решений модератора, ModerationQueue тянет её в useEffect.
export default function AdminModerationPage() {
  const t = useTranslations('admin.moderation');

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{t('heading')}</h2>
      <ModerationQueue />
    </section>
  );
}
