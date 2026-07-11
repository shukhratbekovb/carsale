import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

// Определяет локаль (префикс пути → cookie NEXT_LOCALE → Accept-Language),
// проставляет её в заголовки запроса для i18n/request.ts и делает redirect
// `/ru`-префикса при необходимости.
export default createMiddleware(routing);

export const config = {
  // Все маршруты, кроме служебных Next.js и файлов со статикой (по точке в пути).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
