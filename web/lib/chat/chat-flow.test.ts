import { describe, expect, test } from 'vitest';
import { CURRENT_BUYER_ID } from '@/types/chat';
import type { ChatMessage } from '@/types/chat';
import {
  createInitialChatState,
  pendingMessages,
  queueLocalMessage,
  receiveMessage,
  reconcileSentMessage,
  setMessages,
} from './chat-flow';

const THREAD_ID = 'thread-1';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    threadId: THREAD_ID,
    senderId: 'seller-1',
    text: 'Здравствуйте',
    sentAt: '2026-07-10T14:30:00Z',
    status: 'SENT',
    ...overrides,
  };
}

describe('createInitialChatState', () => {
  test('defaults to an empty message list', () => {
    expect(createInitialChatState()).toEqual({ messages: [] });
  });

  test('accepts an initial message list', () => {
    const message = makeMessage();
    expect(createInitialChatState([message])).toEqual({ messages: [message] });
  });
});

describe('setMessages', () => {
  test('replaces the message list wholesale', () => {
    const message = makeMessage();
    expect(setMessages([message])).toEqual({ messages: [message] });
  });
});

describe('queueLocalMessage', () => {
  test('appends a PENDING message sent by the current buyer', () => {
    const state = createInitialChatState();
    const result = queueLocalMessage(state, 'local-1', THREAD_ID, 'Здравствуйте!');

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({
      id: 'local-1',
      threadId: THREAD_ID,
      senderId: CURRENT_BUYER_ID,
      text: 'Здравствуйте!',
      status: 'PENDING',
    });
  });

  test('does not mutate the previous state', () => {
    const state = createInitialChatState([makeMessage()]);
    const result = queueLocalMessage(state, 'local-1', THREAD_ID, 'Привет');

    expect(state.messages).toHaveLength(1);
    expect(result.messages).toHaveLength(2);
  });
});

describe('reconcileSentMessage', () => {
  test('replaces the message matching localId with the confirmed message', () => {
    const pending = makeMessage({ id: 'local-1', senderId: CURRENT_BUYER_ID, status: 'PENDING' });
    const other = makeMessage({ id: 'msg-6-1' });
    const state = createInitialChatState([other, pending]);
    const confirmed = makeMessage({ id: 'msg-server-1', senderId: CURRENT_BUYER_ID, status: 'SENT' });

    const result = reconcileSentMessage(state, 'local-1', confirmed);

    expect(result.messages).toHaveLength(2);
    expect(result.messages).toContainEqual(other);
    expect(result.messages).toContainEqual(confirmed);
    expect(result.messages.some((message) => message.id === 'local-1')).toBe(false);
  });

  test('leaves other messages untouched', () => {
    const pending = makeMessage({ id: 'local-1', status: 'PENDING' });
    const other = makeMessage({ id: 'msg-other', text: 'unrelated' });
    const state = createInitialChatState([pending, other]);
    const confirmed = makeMessage({ id: 'msg-server-1', status: 'SENT' });

    const result = reconcileSentMessage(state, 'local-1', confirmed);

    expect(result.messages[1]).toEqual(other);
  });
});

describe('receiveMessage', () => {
  test('appends a new message', () => {
    const state = createInitialChatState();
    const incoming = makeMessage();

    const result = receiveMessage(state, incoming);

    expect(result.messages).toEqual([incoming]);
  });

  test('is a no-op when a message with the same id already exists (dedup)', () => {
    const existing = makeMessage({ id: 'msg-dup' });
    const state = createInitialChatState([existing]);
    const duplicate = makeMessage({ id: 'msg-dup', text: 'different text but same id' });

    const result = receiveMessage(state, duplicate);

    expect(result).toBe(state);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual(existing);
  });
});

describe('pendingMessages', () => {
  test('returns only messages with status PENDING', () => {
    const sent = makeMessage({ id: 'msg-sent', status: 'SENT' });
    const pending = makeMessage({ id: 'msg-pending', status: 'PENDING' });
    const state = createInitialChatState([sent, pending]);

    expect(pendingMessages(state)).toEqual([pending]);
  });

  test('returns an empty array when there are no pending messages', () => {
    const state = createInitialChatState([makeMessage({ status: 'SENT' })]);
    expect(pendingMessages(state)).toEqual([]);
  });
});
