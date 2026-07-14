'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { mockFindOrCreateThread } from '@/lib/mock/chat';

interface MessageSellerButtonProps {
  listingId: string;
}

// Точка входа в чат с продавцом (UC-06 основной поток, триггер — кнопка
// «Написать» на карточке/странице объявления). Нет реальной сессии/JWT
// (см. HANDOFF.md) — CURRENT_BUYER_ID в types/chat.ts фиксированный
// demo-профиль, поэтому здесь нет гейта на «войдите сначала»: как и
// /sell/new, /favorites, /payment, фича полностью рабочая без бэкенда.
export function MessageSellerButton({ listingId }: MessageSellerButtonProps) {
  const t = useTranslations('listingPage');
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

  async function handleClick() {
    setIsStarting(true);
    try {
      const thread = await mockFindOrCreateThread(listingId);
      router.push(`/chat/${thread.id}`);
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isStarting}
      className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {isStarting ? t('startingThread') : t('messageSeller')}
    </button>
  );
}
