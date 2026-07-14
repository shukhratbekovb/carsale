import { useTranslations } from 'next-intl';
import { CURRENT_BUYER_ID, type ChatMessage } from '@/types/chat';
import { cn } from '@/lib/utils';

// Узбекистан — фиксированный UTC+5 без перехода на летнее время (DST
// отменён). date.getHours()/getMinutes() читали бы локальный часовой пояс
// ПРОЦЕССА — на сервере это таймзона деплоя (обычно не Ташкент), в браузере
// пользователя — его локальная. Разные значения для одного и того же
// сообщения → тот же класс SSR/CSR hydration-риска, что уже был найден и
// исправлен в lib/format.ts для Intl.NumberFormat('uz'). Вместо этого сдвигаем
// таймстамп на фиксированные +5 часов и читаем его в UTC — не зависит от
// таймзоны окружения вообще, ни сервера, ни клиента.
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

function formatTime(iso: string): string {
  const tashkent = new Date(new Date(iso).getTime() + TASHKENT_OFFSET_MS);
  return `${String(tashkent.getUTCHours()).padStart(2, '0')}:${String(tashkent.getUTCMinutes()).padStart(2, '0')}`;
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const t = useTranslations('chat');
  const isMine = message.senderId === CURRENT_BUYER_ID;
  const time = formatTime(message.sentAt);

  return (
    <div className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-lg px-3 py-2 text-sm',
          isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <p
          className={cn(
            'mt-1 text-right text-[10px]',
            isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {message.status === 'PENDING' ? t('pendingStatus') : time}
        </p>
      </div>
    </div>
  );
}
