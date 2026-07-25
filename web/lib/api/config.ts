// Базовый URL Core API — читается ТОЛЬКО на сервере (в BFF-прокси
// app/api/core/[...path]), никогда не попадает в клиентский бандл. Браузер ходит
// на same-origin /api/core/*, прокси форвардит на Core сервер-к-серверу
// (§5 интеграции фронта). Без CORS/кросс-доменных cookie — refresh_token остаётся
// httpOnly и same-origin.
export const CORE_API_URL = process.env.CORE_API_URL ?? 'http://localhost:4000';
