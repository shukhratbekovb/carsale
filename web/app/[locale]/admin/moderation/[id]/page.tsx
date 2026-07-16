'use client';

import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ModerationDetail } from '@/components/admin/moderation-detail';
import { getModerationItem } from '@/lib/mock/admin';
import type { ModerationItem } from '@/types/admin';

interface ModerationItemPageProps {
  params: { id: string };
}

// Карточка модерации (UC-15 шаги 3–4). Item читается в useEffect, а не при
// рендере: мок-«база» мутирует на клиенте после решений, чтение при SSR дало
// бы расхождение с клиентским состоянием (hydration mismatch).
// undefined — ещё не смотрели; null — смотрели и не нашли → notFound()
// (паттерн несуществующего id — как app/[locale]/payment/[listingId]/page.tsx).
export default function AdminModerationItemPage({ params }: ModerationItemPageProps) {
  const [item, setItem] = useState<ModerationItem | null | undefined>(undefined);

  useEffect(() => {
    setItem(getModerationItem(params.id) ?? null);
  }, [params.id]);

  if (item === undefined) return null;
  if (item === null) notFound();

  return <ModerationDetail item={item} onDecided={setItem} />;
}
