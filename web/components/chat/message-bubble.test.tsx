import { render, screen } from '@/src/test/utils';
import { MessageBubble } from './message-bubble';
import { CURRENT_BUYER_ID } from '@/types/chat';
import type { ChatMessage } from '@/types/chat';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    senderId: 'seller-1',
    text: 'Здравствуйте',
    sentAt: '2026-07-10T14:30:00Z',
    status: 'SENT',
    ...overrides,
  };
}

test('aligns the current buyer own message to the end', () => {
  const { container } = render(<MessageBubble message={makeMessage({ senderId: CURRENT_BUYER_ID })} />);
  expect(container.querySelector('.justify-end')).toBeInTheDocument();
  expect(container.querySelector('.justify-start')).not.toBeInTheDocument();
});

test('aligns the seller message to the start', () => {
  const { container } = render(<MessageBubble message={makeMessage({ senderId: 'seller-1' })} />);
  expect(container.querySelector('.justify-start')).toBeInTheDocument();
  expect(container.querySelector('.justify-end')).not.toBeInTheDocument();
});

test('shows the pending status label instead of a time for a PENDING message', () => {
  render(<MessageBubble message={makeMessage({ status: 'PENDING' })} />);
  expect(screen.getByText('Отправка...')).toBeInTheDocument();
});

test('shows a manually UTC+5-shifted HH:MM time for a SENT message', () => {
  // 14:30 UTC + 5h = 19:30 Tashkent — matches formatTime()'s manual offset in
  // message-bubble.tsx (not Intl/toLocaleTimeString, same hydration-risk class
  // already fixed for Intl.NumberFormat('uz') in lib/format.ts).
  render(<MessageBubble message={makeMessage({ sentAt: '2026-07-10T14:30:00Z', status: 'SENT' })} />);
  expect(screen.getByText('19:30')).toBeInTheDocument();
});

test('renders the message text', () => {
  render(<MessageBubble message={makeMessage({ text: 'Торг уместен?' })} />);
  expect(screen.getByText('Торг уместен?')).toBeInTheDocument();
});
