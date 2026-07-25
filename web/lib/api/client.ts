// Низкоуровневый клиент к Core через same-origin BFF-прокси (/api/core/*).
// Только браузер: сервер ходит на Core напрямую. Держит форму ошибок Core
// ({ error, code, details }) в типизированном ApiError, чтобы UI мог ветвиться
// по `code` (invalid_otp / otp_locked / sms_unavailable / …).

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface CoreRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  // Bearer access-токен (в памяти сессии); опускается на публичных вызовах.
  accessToken?: string | null;
  signal?: AbortSignal;
}

const BASE = '/api/core';

export async function coreFetch<T = unknown>(path: string, req: CoreRequest = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (req.body !== undefined) headers['content-type'] = 'application/json';
  if (req.accessToken) headers['authorization'] = `Bearer ${req.accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: req.method ?? 'GET',
      headers,
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      credentials: 'same-origin', // refresh_token cookie на нашем origin
      ...(req.signal ? { signal: req.signal } : {}),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Network request failed');
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload: unknown = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const errObj = (payload ?? {}) as { error?: string; code?: string; details?: unknown };
    throw new ApiError(
      res.status,
      errObj.code ?? 'request_failed',
      errObj.error ?? `Request failed with ${res.status}`,
      errObj.details,
    );
  }
  return payload as T;
}
