import { useTranslations } from 'next-intl';
import { ChatThreadList } from '@/components/chat/chat-thread-list';

// Inbox (FE-5, UC-06). CSR + мок-WebSocket (frontend-plan.md §5,
// `/chat` — «CSR + WebSocket»), нет SEO-ценности.
export default function ChatInboxPage() {
  const t = useTranslations('chat');

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('pageTitle')}</h1>
      <ChatThreadList />
    </main>
  );
}
