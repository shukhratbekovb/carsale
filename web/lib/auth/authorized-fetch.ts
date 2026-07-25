// Авторизованный вызов Core с авто-refresh (§5). Прикрепляет текущий access из
// token-store; на 401 (access истёк — время жизни 15 мин) один раз обновляет
// токен по refresh cookie и повторяет запрос. Это делает сессию долговечной:
// без этого пользователя выбрасывало бы через 15 минут до перезагрузки страницы.
import { ApiError, type CoreRequest, coreFetch } from '@/lib/api/client';
import { getAccessToken, refreshAccessToken } from '@/lib/auth/token-store';

export async function authorizedFetch<T = unknown>(
  path: string,
  req: Omit<CoreRequest, 'accessToken'> = {},
): Promise<T> {
  try {
    return await coreFetch<T>(path, { ...req, accessToken: getAccessToken() });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const token = await refreshAccessToken();
      if (token) return await coreFetch<T>(path, { ...req, accessToken: token });
    }
    throw err;
  }
}
