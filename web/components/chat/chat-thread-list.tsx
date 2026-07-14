'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { mockFetchThreads } from '@/lib/mock/chat';
import { cn } from '@/lib/utils';
import type { ChatThread } from '@/types/chat';

// undefined — список ещё грузится.
export function ChatThreadList() {
  const t = useTranslations('chat');
  const [threads, setThreads] = useState<ChatThread[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    mockFetchThreads().then((result) => {
      if (!cancelled) setThreads(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (threads === undefined) {
    return null;
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="text-lg font-semibold">{t('emptyTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('emptyMessage')}</p>
        <Link
          href="/catalog"
          className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('browseCatalog')}
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {threads.map((thread) => (
        <li key={thread.id}>
          <Link
            href={`/chat/${thread.id}`}
            className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('truncate font-medium', thread.unreadCount > 0 && 'font-semibold')}>
                  {thread.sellerName}
                </span>
                <span className="shrink-0 truncate text-xs text-muted-foreground">
                  · {thread.listingTitle}
                </span>
              </div>
              <p
                className={cn(
                  'truncate text-sm text-muted-foreground',
                  thread.unreadCount > 0 && 'text-foreground'
                )}
              >
                {thread.lastMessagePreview}
              </p>
            </div>
            {thread.unreadCount > 0 && (
              <span
                aria-label={t('unreadBadge', { count: thread.unreadCount })}
                className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground"
              >
                {thread.unreadCount}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
