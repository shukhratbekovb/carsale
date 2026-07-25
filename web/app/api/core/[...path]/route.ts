import { type NextRequest, NextResponse } from 'next/server';
import { CORE_API_URL } from '@/lib/api/config';

/**
 * BFF-прокси Core API (§5 интеграции фронта). Браузер ходит на same-origin
 * `/api/core/*`, этот обработчик форвардит запрос на Core сервер-к-серверу.
 * Зачем прокси, а не прямые кросс-доменные вызовы: Core ставит refresh_token
 * как httpOnly + SameSite=Lax cookie и не имеет CORS — кросс-origin браузер не
 * смог бы ни отправить, ни получить эту cookie. Прокси:
 *  - форвардит Authorization (Bearer access) и тело как есть (JSON и multipart);
 *  - пробрасывает входящую refresh_token cookie в Core (для /auth/refresh|logout);
 *  - реэмитит Set-Cookie от Core на same-origin ответе (refresh живёт на 3100).
 * Access-токен в теле ответа — им распоряжается клиент (в памяти сессии).
 */

// Прокси не должен кэшироваться и обязан выполняться в Node-рантайме (нужен
// доступ к getSetCookie/стриму тела).
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REFRESH_COOKIE = 'refresh_token';

// Заголовки, которые НЕ форвардим на Core (hop-by-hop + хостовые).
const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'cookie', // cookie собираем вручную из next-cookies (только refresh_token)
]);

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const search = req.nextUrl.search;
  const target = `${CORE_API_URL}/${path.join('/')}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_REQUEST_HEADERS.has(key)) headers.set(key, value);
  });
  // Пробрасываем только refresh_token — Core читает его для ротации/логаута.
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) headers.set('cookie', `${REFRESH_COOKIE}=${refresh}`);

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody ? Buffer.from(await req.arrayBuffer()) : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { error: 'Core API unavailable', code: 'core_unavailable' },
      { status: 502 },
    );
  }

  // Тело как есть (JSON/бинарь) — не парсим, чтобы прокси был контент-агностичным.
  const payload = Buffer.from(await upstream.arrayBuffer());
  const res = new NextResponse(payload, { status: upstream.status });

  const contentType = upstream.headers.get('content-type');
  if (contentType) res.headers.set('content-type', contentType);
  // Реэмитим Set-Cookie от Core на наш origin (refresh_token: set/clear).
  for (const cookie of upstream.headers.getSetCookie()) {
    res.headers.append('set-cookie', cookie);
  }
  return res;
}

type Ctx = { params: { path: string[] } };

export const GET = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
export const POST = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
export const PUT = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
export const PATCH = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
export const DELETE = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
