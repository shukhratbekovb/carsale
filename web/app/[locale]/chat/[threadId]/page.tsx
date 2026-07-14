import { ChatWindow } from '@/components/chat/chat-window';

interface ChatThreadPageProps {
  params: { threadId: string };
}

// Открытый тред (FE-5, UC-06). ChatWindow сам грузит тред/историю и держит
// WS-подписку/офлайн-очередь — страница только собирает layout.
export default function ChatThreadPage({ params }: ChatThreadPageProps) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ChatWindow threadId={params.threadId} />
    </main>
  );
}
