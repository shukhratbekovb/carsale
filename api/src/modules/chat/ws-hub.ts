import type { Server as HttpServer } from 'node:http';
import type { Server as IoServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../../lib/jwt.js';
import { logger } from '../../lib/logger.js';
import { isParticipant } from './repository.js';
import { type MessageDto, setMessageEmitter } from './service.js';

/**
 * WebSocket Hub чата (BE-5.2/5.3, §6.4). Socket.IO поверх того же http-сервера.
 * JWT-handshake аутентифицирует соединение; клиент join'ит комнату треда только
 * если он участник; новые сообщения пушатся в комнату событием `new_message`.
 *
 * socket.io импортируется ДИНАМИЧЕСКИ внутри initChatHub — чтобы тяжёлая
 * зависимость не тянулась в граф модулей на каждом тесте (только при старте сервера).
 */

const roomOf = (threadId: string): string => `thread:${threadId}`;

// Ленивый синглтон io: emitNewMessage — no-op, пока хаб не инициализирован
// (REST-only режим / юнит-тесты), поэтому service может звать его безопасно.
let io: IoServer | null = null;

/** Проверка токена из handshake — вынесено для юнит-тестируемости (без socket.io). */
export function authenticateSocketToken(token: unknown): string {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('missing token');
  }
  return verifyAccessToken(token).sub;
}

export async function initChatHub(httpServer: HttpServer): Promise<IoServer> {
  const { Server } = await import('socket.io');
  io = new Server(httpServer, {
    // dev: фронт на другом порту; в prod origin сузить через env
    cors: { origin: true, credentials: true },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    try {
      socket.data.userId = authenticateSocketToken(socket.handshake.auth?.['token']);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;

    // join принимает ack-колбэк: клиент узнаёт, впустили ли его в комнату
    socket.on('join', async (threadId: unknown, ack?: (r: { ok: boolean }) => void) => {
      if (typeof threadId !== 'string' || !(await isParticipant(threadId, userId))) {
        ack?.({ ok: false });
        return;
      }
      await socket.join(roomOf(threadId));
      ack?.({ ok: true });
    });

    socket.on('leave', (threadId: unknown) => {
      if (typeof threadId === 'string') void socket.leave(roomOf(threadId));
    });
  });

  // Регистрируем эмиттер в сервисе: sendMessage будет пушить через этот хаб
  setMessageEmitter(emitNewMessage);

  logger.info('chat WebSocket hub initialized');
  return io;
}

/** Пуш нового сообщения в комнату треда (no-op, если хаб не поднят). */
function emitNewMessage(threadId: string, message: MessageDto): void {
  io?.to(roomOf(threadId)).emit('new_message', message);
}

/** Для graceful shutdown / тестов. */
export async function closeChatHub(): Promise<void> {
  if (io) {
    await io.close();
    io = null;
  }
}
